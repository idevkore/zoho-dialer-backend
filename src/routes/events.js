import { Router } from 'express';
import { logCompletedCallToZoho, rememberRecordingUrl } from '../services/callLogger.js';

const router = Router();

/**
 * Twilio status / recording callbacks.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function postEvents(req, res) {
  const payload = /** @type {Record<string, string | undefined>} */ (req.body ?? {});

  try {
    const verbose =
      process.env.DEBUG_TWILIO_EVENTS === '1' ||
      process.env.DEBUG_TWILIO_EVENTS === 'true' ||
      process.env.DEBUG_TWILIO_EVENTS === 'yes';
    if (verbose) {
      console.info('[haulos] twilio:event:verbose', { tenantId: req.tenant?.tenantId, ...payload });
    } else {
      console.info(
        `[haulos] twilio:event tenant=${req.tenant?.tenantId} CallSid=${payload.CallSid ?? '-'} ` +
          `CallStatus=${payload.CallStatus ?? '-'} RecordingStatus=${payload.RecordingStatus ?? '-'} ` +
          `Duration=${payload.CallDuration ?? '-'}`,
      );
    }

    if (payload.RecordingUrl && payload.CallSid) {
      rememberRecordingUrl(payload.CallSid, payload.RecordingUrl);
    }
  } catch (err) {
    console.error('[haulos] twilio:event handler error (still ACKing Twilio):', err);
  }

  if (!res.headersSent) {
    res.status(200).end();
  }

  if (payload.CallStatus === 'completed' && req.tenant) {
    void logCompletedCallToZoho(payload, req.tenant).catch((err) => {
      console.error('[haulos] twilio:event deferred Zoho log failed:', err);
    });
  }
}

router.post('/events', postEvents);

export default router;
