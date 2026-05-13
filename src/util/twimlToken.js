import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Create a short-lived JWT used to authorize Twilio fetches of generated TwiML (voicemail play).
 * @param {string} tenantId
 * @param {string} [purpose='voicemail']
 * @returns {string}
 */
export function signTwimlToken(tenantId, purpose = 'voicemail') {
  return jwt.sign({ tenantId, purpose }, config.jwtSecret, { expiresIn: '10m' });
}

/**
 * Verify TwiML token and return payload.
 * @param {string} token
 * @returns {{ tenantId: string; purpose: string }}
 */
export function verifyTwimlToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (typeof payload === 'string' || !payload || typeof payload !== 'object') {
    throw new Error('Invalid token payload');
  }
  const { tenantId, purpose } = /** @type {Record<string, unknown>} */ (payload);
  if (typeof tenantId !== 'string' || typeof purpose !== 'string') {
    throw new Error('Invalid token claims');
  }
  return { tenantId, purpose };
}
