import twilio from 'twilio';
import { config } from '../config/index.js';

/**
 * Validate Twilio webhook signature in production.
 * Skips validation outside production so local tunneling/dev works.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function twilioWebhookAuth(req, res, next) {
  if (config.nodeEnv !== 'production') {
    return next();
  }

  const authToken = req.tenant?.authToken;
  const signature = req.header('x-twilio-signature');
  const baseUrl = config.publicBaseUrl?.replace(/\/$/, '');

  if (!authToken) {
    return res.status(500).json({ error: 'Twilio auth token unavailable for signature validation' });
  }
  if (!baseUrl) {
    return res.status(500).json({ error: 'PUBLIC_BASE_URL is required in production for webhook validation' });
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
