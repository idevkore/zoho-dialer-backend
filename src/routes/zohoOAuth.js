import { Router } from 'express';
import { getZohoOAuthClientConfig } from '../config/tenants.js';
import { exchangeZohoAuthorizationCode } from '../services/zohoOAuthService.js';

const router = Router();

/**
 * Exchange Zoho OAuth authorization `code` for refresh token (server-based / browser consent flow).
 * Registered before Twilio webhook routes so this path is never subject to `X-Twilio-Signature`.
 *
 * Query: **`code`** (from Zoho). Tenant slug: **`tenantId`** (if you add it to the callback URL) or
 * **`state`** (recommended — Zoho echoes `state` from the authorize URL on redirect; arbitrary
 * query params on `redirect_uri` alone are not always preserved).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get('/zoho/oauth/callback', async (req, res, next) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  const tenantFromQuery = typeof req.query.tenantId === 'string' ? req.query.tenantId.trim() : '';
  const tenantFromState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
  const tenantId = tenantFromQuery || tenantFromState;

  if (!code || !tenantId) {
    return res.status(400).json({
      error: 'Missing query parameters',
      detail:
        'Required: code (from Zoho). Tenant slug: use OAuth state (add &state=kore on the authorize URL — Zoho echoes it here) or append &tenantId=kore on the callback URL.',
    });
  }

  try {
    const oauth = getZohoOAuthClientConfig(tenantId);
    const tokenResponse = await exchangeZohoAuthorizationCode({
      code,
      clientId: oauth.zohoClientId,
      clientSecret: oauth.zohoClientSecret,
      redirectUri: oauth.redirectUri,
      accountsDomain: oauth.accountsDomain,
    });

    const rawApiDomain = tokenResponse.api_domain;
    const apiDomainUrl =
      typeof rawApiDomain === 'string'
        ? rawApiDomain.startsWith('http')
          ? rawApiDomain
          : `https://${rawApiDomain}`
        : undefined;

    const nextSteps = [
      `Set ZOHO_${oauth.tenantId}_REFRESH_TOKEN in Forge (or .env) to the returned refresh_token value.`,
    ];
    if (apiDomainUrl) {
      nextSteps.push(`If needed, set ZOHO_${oauth.tenantId}_API_DOMAIN=${apiDomainUrl}`);
    }

    return res.json({
      ok: true,
      tenantId: oauth.tenantId,
      refresh_token: tokenResponse.refresh_token,
      api_domain: tokenResponse.api_domain,
      expires_in: tokenResponse.expires_in,
      token_type: tokenResponse.token_type,
      scope: typeof tokenResponse.scope === 'string' ? tokenResponse.scope : undefined,
      next_steps: nextSteps,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
