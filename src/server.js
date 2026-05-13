import './registerFatalHandlers.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import api from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const voicemailAssetsDir = path.join(__dirname, '..', 'voicemail-assets');
const voicemailStatic = express.static(voicemailAssetsDir, { index: false, dotfiles: 'deny' });

/** Exact origins or `https://*.suffix` patterns (suffix = registrable-style host, e.g. zoho.com). */
const ALLOWED_WIDGET_ORIGINS = [
  'https://crm.zoho.com',
  'https://crm.zohocloud.ca',
  'https://plugin-haulosdialerwidget.zohosandbox.com',
  'https://*.zohosandbox.com',
  'https://*.zoho.com',
  'https://*.zohousercontent.com',
  'https://127.0.0.1:5000',
];

function isWidgetOriginAllowed(origin) {
  if (!origin) return true;
  for (const entry of ALLOWED_WIDGET_ORIGINS) {
    if (entry.startsWith('https://*.')) {
      const suffix = entry.slice('https://*.'.length);
      try {
        const u = new URL(origin);
        if (u.protocol !== 'https:') continue;
        const h = u.hostname;
        if (h === suffix || h.endsWith(`.${suffix}`)) return true;
      } catch {
        continue;
      }
    } else if (origin === entry) {
      return true;
    }
  }
  return false;
}

const app = express();

app.disable('x-powered-by');
app.use(
  helmet({
    frameguard: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        frameAncestors: [
          "'self'",
          'https://crm.zoho.com',
          'https://crm.zohocloud.ca',
          'https://plugin-haulosdialerwidget.zohosandbox.com',
          'https://*.zoho.com',
          'https://*.zohosandbox.com',
          'https://*.zohousercontent.com',
          'https://127.0.0.1:5000',
        ],
        scriptSrc: ["'self'", 'https://unpkg.com'],
        connectSrc: ["'self'", 'https://*.twilio.com', 'wss://*.twilio.com'],
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function sendHealth(_req, res) {
  res.json({ ok: true, service: 'zoho-dialer-backend' });
}

/** Root probe (full Node URL). */
app.get('/health', sendHealth);

/**
 * API-prefix probe: registered on the root `app` before `app.use('/api/v1', api)` so
 * GET /api/v1/health never enters the API router (avoids falling through to Twilio
 * webhook middleware on older or mis-ordered builds).
 */
app.get('/api/v1/health', sendHealth);

/** Sample voicemail MP3 (Postman + defaults). Also under /api/v1 so Nginx /api-only proxies reach Node. */
app.use('/voicemail-assets', voicemailStatic);
app.use('/api/v1/voicemail-assets', voicemailStatic);

/** Zoho CRM Telephony widget static assets (built to src/public/app/). */
const zohoWidgetHtmlPath = path.join(__dirname, 'public', 'app', 'widget.html');
app.use('/app', (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || isWidgetOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get('/app/widget.html', (_req, res, next) => {
  res.type('html');
  res.sendFile(zohoWidgetHtmlPath, { dotfiles: 'deny' }, (err) => {
    if (err) next(err);
  });
});
app.use('/app', express.static(path.join(__dirname, 'public', 'app')));

app.use('/api/v1', api);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number(err.status) || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message || 'Error';
  res.status(status).json({ error: message });
});

/** Bind IPv4 so Nginx `proxy_pass http://127.0.0.1:PORT` can connect (avoid ::-only listen). */
const listenHost = '0.0.0.0';
const server = app.listen(config.port, listenHost, () => {
  console.log(`Listening on http://${listenHost}:${config.port} (${config.nodeEnv})`);
});
server.on('error', (err) => {
  console.error(`Failed to listen on ${listenHost}:${config.port}`, err);
  process.exitCode = 1;
});
