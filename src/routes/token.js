import { Router } from 'express';
import twilio from 'twilio';
import { tenantResolver } from '../middleware/tenantResolver.js';

const router = Router();

/**
 * Issue a Twilio Voice SDK access token for the tenant's TwiML application.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function issueToken(req, res, next) {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(500).json({ error: 'Tenant context missing' });
    }

    const identity =
      typeof req.query.identity === 'string' && req.query.identity.trim()
        ? req.query.identity.trim()
        : 'agent';

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      tenant.accountSid,
      tenant.apiKeySid,
      tenant.apiKeySecret,
      { identity, ttl: 3600 },
    );

    const grant = new VoiceGrant({
      outgoingApplicationSid: tenant.twimlAppSid,
      incomingAllow: true,
    });
    token.addGrant(grant);

    const jwt = token.toJwt();
    return res.json({ token: jwt, identity, expiresIn: 3600 });
  } catch (err) {
    return next(err);
  }
}

router.get('/token', tenantResolver, issueToken);

export default router;
