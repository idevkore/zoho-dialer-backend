import { Router } from 'express';
import twilio from 'twilio';
import { config } from '../config/index.js';

const router = Router();

/**
 * Outbound / client leg TwiML: dial PSTN or another Twilio Client.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function postVoice(req, res) {
  const tenant = req.tenant;
  const to = req.body?.To;
  console.info(`[haulos] voice twiml tenant=${tenant?.tenantId} To=${typeof to === 'string' ? to : '(none)'}`);

  const vr = new twilio.twiml.VoiceResponse();

  const dial = vr.dial({
    callerId: tenant?.callerId,
    record: 'record-from-answer',
    recordingStatusCallback:
      config.publicBaseUrl && tenant
        ? `${config.publicBaseUrl.replace(/\/$/, '')}/api/v1/events?tenantId=${encodeURIComponent(
            tenant.tenantId,
          )}`
        : undefined,
    recordingStatusCallbackMethod: 'POST',
  });

  if (typeof to === 'string' && to.startsWith('client:')) {
    dial.client({}, to.replace(/^client:/, ''));
  } else if (to) {
    dial.number(to);
  } else {
    vr.say('Missing destination.');
  }

  res.type('text/xml').send(vr.toString());
}

router.post('/voice', postVoice);

export default router;
