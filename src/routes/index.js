import { Router } from 'express';
import tokenRouter from './token.js';
import voiceRouter from './voice.js';
import inboundRouter from './inbound.js';
import eventsRouter from './events.js';
import voicemailRouter from './voicemail.js';
import { twilioTenantContext } from '../middleware/twilioTenantContext.js';
import { twilioWebhookAuth } from '../middleware/twilioWebhookAuth.js';

const api = Router();

api.get('/health', (_req, res) => {
  // Duplicates root GET /health so probes work when Nginx only proxies /api/* to Node.
  res.json({ ok: true, service: 'zoho-dialer-backend' });
});

const twilioWebhooks = Router();
twilioWebhooks.use(twilioTenantContext, twilioWebhookAuth);

twilioWebhooks.use(voiceRouter);
twilioWebhooks.use(inboundRouter);
twilioWebhooks.use(eventsRouter);

api.use('/', tokenRouter);
api.use('/', twilioWebhooks);
api.use('/', voicemailRouter);

export default api;
