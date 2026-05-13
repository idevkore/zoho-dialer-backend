import { Router } from 'express';
import twilio from 'twilio';
import { config } from '../config/index.js';
import { getTenantConfig } from '../config/tenants.js';
import { TwilioService } from '../services/twilioService.js';
import { signTwimlToken, verifyTwimlToken } from '../util/twimlToken.js';

const router = Router();

/**
 * Live-call redirect to voicemail drop (returns JSON).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function postVoicemailDrop(req, res, next) {
  try {
    const callSid = typeof req.body?.callSid === 'string' ? req.body.callSid.trim() : '';
    const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : '';
    if (!callSid || !tenantId) {
      return res.status(400).json({ error: 'callSid and tenantId are required' });
    }
    if (!config.publicBaseUrl) {
      return res.status(500).json({ error: 'PUBLIC_BASE_URL is required for voicemail redirect URLs' });
    }

    const tenant = getTenantConfig(tenantId);
    if (!tenant.voicemailUrl) {
      return res.status(500).json({ error: 'TWILIO_*_VOICEMAIL_URL is not configured for this tenant' });
    }

    const sig = signTwimlToken(tenant.tenantId, 'voicemail');
    const base = config.publicBaseUrl.replace(/\/$/, '');
    const twimlUrl = `${base}/api/v1/twiml/voicemail?sig=${encodeURIComponent(sig)}`;

    const svc = new TwilioService(tenant);
    await svc.redirectCall(callSid, twimlUrl);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
}

/**
 * TwiML that plays the tenant's voicemail audio (fetched by Twilio after redirect).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getVoicemailTwiML(req, res) {
  try {
    const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
    const { tenantId, purpose } = verifyTwimlToken(sig);
    if (purpose !== 'voicemail') {
      return res.status(400).send('Invalid token purpose');
    }

    const tenant = getTenantConfig(tenantId);
    if (!tenant.voicemailUrl) {
      return res.status(500).send('Voicemail URL not configured');
    }

    const vr = new twilio.twiml.VoiceResponse();
    vr.play(tenant.voicemailUrl);
    res.type('text/xml').send(vr.toString());
  } catch {
    return res.status(401).send('Unauthorized');
  }
}

router.post('/voicemail', postVoicemailDrop);
router.get('/twiml/voicemail', getVoicemailTwiML);

export default router;
