import { Router } from 'express';
import { getZohoOAuthClientConfig } from '../config/tenants.js';
import { exchangeZohoAuthorizationCode } from '../services/zohoOAuthService.js';

const router = Router();

/**
 * Exchange Zoho OAuth authorization `code` for refresh token (server-based / browser consent flow).
 * Registered before Twilio webhook routes so this path is never subject to `X-Twilio-Signature`.
 *
 * Query: **`code`** (from Zoho redirect) and **`tenantId`** (slug, e.g. `kore`). Zoho does not add
 * `tenantId` for you — after the redirect, append **`&tenantId=kore`** to the callback URL (same
 * path Zoho opened) before loading it again or calling this endpoint from Postman.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get('/zoho/oauth/callback', async (req, res, next) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId.trim() : '';

  if (!code || !tenantId) {
    return res.status(400).json({
      error: 'Missing query parameters',
      detail:
        'Required: code (from Zoho redirect) and tenantId (e.g. kore). Append &tenantId=kore to the callback URL Zoho sent you to, then reload or copy the full URL.',
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
