import { getTenantConfig, getTenantIdByInboundNumber } from '../config/tenants.js';

/**
 * Resolve tenant for Twilio webhooks using body, query, or inbound `To` number.
 * Attaches `req.tenant` for downstream middleware and handlers.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function twilioTenantContext(req, res, next) {
  const fromBody = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : '';
  const fromQuery = typeof req.query?.tenantId === 'string' ? req.query.tenantId.trim() : '';
  const fromInbound = getTenantIdByInboundNumber(req.body?.To);

  const tenantId = fromBody || fromQuery || fromInbound;
  if (!tenantId) {
    return res.status(400).json({
      error:
        'tenantId is required (set on webhook URL as ?tenantId=..., include in POST body, or configure TWILIO_*_INBOUND_NUMBER for automatic lookup)',
    });
  }
  try {
    req.tenant = getTenantConfig(tenantId);
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(404).json({ error: 'Tenant not found', detail: message });
  }
}
