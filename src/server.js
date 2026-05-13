import './registerFatalHandlers.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import api from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
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
