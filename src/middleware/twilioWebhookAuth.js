import twilio from 'twilio';
import { config } from '../config/index.js';

function skipTwilioSigValidationEnabled() {
  const v = String(process.env.SKIP_TWILIO_SIG_VALIDATION ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

const _skipSig = skipTwilioSigValidationEnabled();
if (_skipSig && config.nodeEnv === 'production') {
  console.warn(
    '[twilioWebhookAuth] SKIP_TWILIO_SIG_VALIDATION is enabled while NODE_ENV=production. Webhook requests will not be signature-checked. Disable before exposing untrusted traffic.',
  );
}
console.info(
  `[twilioWebhookAuth] skipSignatureValidation=${_skipSig} (NODE_ENV=${config.nodeEnv}, SKIP_TWILIO_SIG_VALIDATION=${JSON.stringify(process.env.SKIP_TWILIO_SIG_VALIDATION ?? '')})`,
);

/**
 * Validate Twilio webhook `X-Twilio-Signature` (HMAC-SHA1 over full URL + sorted form params).
 *
 * Set `SKIP_TWILIO_SIG_VALIDATION` to `true`, `1`, `yes`, or `on` (trimmed) to bypass checks
 * (Postman / TwiML-only testing). A **warning is logged at startup** if this is enabled while
 * `NODE_ENV=production` — remove the flag on any host that faces untrusted clients.
 *
 * The signed URL must match `PUBLIC_BASE_URL` + `req.originalUrl` byte-for-byte (scheme,
 * host, path, query).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function twilioWebhookAuth(req, res, next) {
  if (skipTwilioSigValidationEnabled()) {
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
