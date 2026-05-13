import twilio from 'twilio';
import { config } from '../config/index.js';

/**
 * Validate Twilio webhook `X-Twilio-Signature` (HMAC-SHA1 over full URL + sorted form params).
 *
 * - **Production:** always validates (ignores `SKIP_TWILIO_SIG_VALIDATION`).
 * - **Non-production:** validates by default so Postman + a matching `PUBLIC_BASE_URL` can
 *   exercise the same path as prod. Set `SKIP_TWILIO_SIG_VALIDATION=true` to bypass when
 *   you only care about TwiML/body behavior.
 *
 * The signed URL must match `PUBLIC_BASE_URL` + `req.originalUrl` byte-for-byte (scheme,
 * host, path, query).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function twilioWebhookAuth(req, res, next) {
  const skipForDev =
    config.nodeEnv !== 'production' && process.env.SKIP_TWILIO_SIG_VALIDATION === 'true';

  if (skipForDev) {
    return next();
  }

  const authToken = req.tenant?.authToken;
  const signature = req.header('x-twilio-signature');
  const baseUrl = config.publicBaseUrl?.replace(/\/$/, '');

  if (!authToken) {
    return res.status(500).json({ error: 'Twilio auth token unavailable for signature validation' });
  }
  if (!baseUrl) {
    return res.status(500).json({
      error: 'PUBLIC_BASE_URL is required for Twilio webhook signature validation',
    });
  }
  if (!signature) {
    return res.status(403).json({ error: 'Missing X-Twilio-Signature' });
  }

  const fullUrl = `${baseUrl}${req.originalUrl}`;
  const params = /** @type {Record<string, string>} */ (req.body ?? {});
  const valid = twilio.validateRequest(authToken, signature, fullUrl, params);

  if (!valid) {
    return res.status(403).json({ error: 'Invalid Twilio signature' });
  }
  return next();
}
