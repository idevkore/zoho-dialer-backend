import { Router } from 'express';
import { config } from '../config/index.js';
import { logCompletedCallToZoho, rememberRecordingUrl } from '../services/callLogger.js';

const router = Router();

/**
 * Twilio status / recording callbacks.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function postEvents(req, res) {
  const payload = /** @type {Record<string, string | undefined>} */ (req.body ?? {});

  if (config.nodeEnv !== 'production') {
    console.info('[twilio:event]', payload);
  }

  if (payload.RecordingUrl && payload.CallSid) {
    rememberRecordingUrl(payload.CallSid, payload.RecordingUrl);
  }

  if (payload.CallStatus === 'completed' && req.tenant) {
    await logCompletedCallToZoho(payload, req.tenant);
  }

  res.status(200).end();
}

router.post('/events', postEvents);

export default router;
