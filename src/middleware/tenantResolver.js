import { getTenantConfig } from '../config/tenants.js';

/**
 * Express middleware: require `X-Tenant-ID`, attach `req.tenant` from env-backed config.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function tenantResolver(req, res, next) {
  const tenantId = req.header('x-tenant-id')?.trim();
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing X-Tenant-ID header' });
  }
  try {
    req.tenant = getTenantConfig(tenantId);
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not fully configured') || message.includes('valid characters')) {
      return res.status(404).json({ error: 'Tenant not found', detail: message });
    }
    return next(err);
  }
}
