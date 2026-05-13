import { Router } from 'express';
import tokenRouter from './token.js';
import zohoOAuthRouter from './zohoOAuth.js';
import voiceRouter from './voice.js';
import inboundRouter from './inbound.js';
import eventsRouter from './events.js';
import voicemailRouter from './voicemail.js';
import widgetCallLogRouter from './widgetCallLog.js';
import { twilioTenantContext } from '../middleware/twilioTenantContext.js';
import { twilioWebhookAuth } from '../middleware/twilioWebhookAuth.js';

const api = Router();

const twilioWebhooks = Router();
twilioWebhooks.use(twilioTenantContext, twilioWebhookAuth);

twilioWebhooks.use(voiceRouter);
twilioWebhooks.use(inboundRouter);
twilioWebhooks.use(eventsRouter);

api.use('/', zohoOAuthRouter);
api.use('/', tokenRouter);
api.use('/', widgetCallLogRouter);
api.use('/', twilioWebhooks);
api.use('/', voicemailRouter);

export default api;
