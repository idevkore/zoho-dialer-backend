import { config } from './index.js';

/**
 * Normalize tenant slug for env key matching (alphanumeric + underscore).
 * @param {string} tenantId
 * @returns {string}
 */
export function sanitizeTenantId(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId must be a non-empty string');
  }
  const cleaned = tenantId.replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleaned) {
    throw new Error('tenantId contains no valid characters');
  }
  return cleaned;
}

/**
 * Read first matching namespaced env var for common slug casings.
 * TODO: Replace with Azure Key Vault secret resolution keyed by tenant + field.
 * @param {string} prefix e.g. TWILIO or ZOHO
 * @param {string} tenantId
 * @param {string} suffix e.g. ACCOUNT_SID
 * @returns {string | undefined}
 */
function readNamespaced(prefix, tenantId, suffix) {
  const t = sanitizeTenantId(tenantId);
  const keys = [
    `${prefix}_${t}_${suffix}`,
    `${prefix}_${t.toUpperCase()}_${suffix}`,
    `${prefix}_${t.toLowerCase()}_${suffix}`,
  ];
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * Discover configured tenant slugs from env (TWILIO_*_ACCOUNT_SID) or TENANT_SLUGS.
 * @returns {string[]}
 */
export function listTenantSlugs() {
  if (config.tenantSlugs?.length) {
    return [...new Set(config.tenantSlugs.map((s) => sanitizeTenantId(s)))];
  }
  const slugs = new Set();
  const re = /^TWILIO_(.+)_ACCOUNT_SID$/;
  for (const key of Object.keys(process.env)) {
    const m = key.match(re);
    if (m?.[1]) {
      slugs.add(m[1]);
    }
  }
  return [...slugs];
}

/**
 * Resolve tenant slug from inbound Twilio `To` number by matching TWILIO_*_INBOUND_NUMBER.
 * @param {string} toNumber E.164 or other format Twilio sends
 * @returns {string | undefined}
 */
export function getTenantIdByInboundNumber(toNumber) {
  if (!toNumber) return undefined;
  const normalized = toNumber.replace(/\s/g, '');
  for (const slug of listTenantSlugs()) {
    const inbound = readNamespaced('TWILIO', slug, 'INBOUND_NUMBER');
    if (!inbound) continue;
    if (inbound.replace(/\s/g, '') === normalized) {
      return slug;
    }
  }
  return undefined;
}

/**
 * Load all credentials for a tenant from namespaced environment variables.
 *
 * TODO (Azure Key Vault migration): move each secret to Key Vault with a naming scheme like
 * `twilio/{tenantId}/account-sid` and load at process start or on first request with caching.
 * Use Managed Identity in Azure or workload identity on AWS if you leave Forge later.
 *
 * @param {string} tenantId Tenant slug (e.g. "kore")
 * @returns {{
 *   tenantId: string;
 *   accountSid: string;
 *   authToken: string;
 *   apiKeySid: string;
 *   apiKeySecret: string;
 *   twimlAppSid: string;
 *   callerId: string;
 *   inboundNumber: string | undefined;
 *   voicemailUrl: string | undefined;
 *   zohoClientId: string;
 *   zohoClientSecret: string;
 *   zohoRefreshToken: string;
 *   zohoOrgId: string;
 *   zohoApiDomain: string;
 * }}
 */
export function getTenantConfig(tenantId) {
  const slug = sanitizeTenantId(tenantId);

  const accountSid = readNamespaced('TWILIO', slug, 'ACCOUNT_SID');
  const authToken = readNamespaced('TWILIO', slug, 'AUTH_TOKEN');
  const apiKeySid = readNamespaced('TWILIO', slug, 'API_KEY_SID');
  const apiKeySecret = readNamespaced('TWILIO', slug, 'API_KEY_SECRET');
  const twimlAppSid = readNamespaced('TWILIO', slug, 'TWIML_APP_SID');
  const callerId = readNamespaced('TWILIO', slug, 'CALLER_ID');
  const inboundNumber = readNamespaced('TWILIO', slug, 'INBOUND_NUMBER');
  const voicemailUrl = readNamespaced('TWILIO', slug, 'VOICEMAIL_URL');

  const zohoClientId = readNamespaced('ZOHO', slug, 'CLIENT_ID');
  const zohoClientSecret = readNamespaced('ZOHO', slug, 'CLIENT_SECRET');
  const zohoRefreshToken = readNamespaced('ZOHO', slug, 'REFRESH_TOKEN');
  const zohoOrgId = readNamespaced('ZOHO', slug, 'ORG_ID');
  const zohoApiDomain =
    readNamespaced('ZOHO', slug, 'API_DOMAIN')?.replace(/\/$/, '') ||
    'https://www.zohoapis.com';

  const missing = [];
  if (!accountSid) missing.push('TWILIO_*_ACCOUNT_SID');
  if (!authToken) missing.push('TWILIO_*_AUTH_TOKEN');
  if (!apiKeySid) missing.push('TWILIO_*_API_KEY_SID');
  if (!apiKeySecret) missing.push('TWILIO_*_API_KEY_SECRET');
  if (!twimlAppSid) missing.push('TWILIO_*_TWIML_APP_SID');
  if (!callerId) missing.push('TWILIO_*_CALLER_ID');
  if (!zohoClientId) missing.push('ZOHO_*_CLIENT_ID');
  if (!zohoClientSecret) missing.push('ZOHO_*_CLIENT_SECRET');
  if (!zohoRefreshToken) missing.push('ZOHO_*_REFRESH_TOKEN');
  if (!zohoOrgId) missing.push('ZOHO_*_ORG_ID');

  if (missing.length) {
    throw new Error(
      `Tenant "${slug}" is not fully configured. Missing: ${missing.join(', ')}`,
    );
  }

  return {
    tenantId: slug,
    accountSid,
    authToken,
    apiKeySid,
    apiKeySecret,
    twimlAppSid,
    callerId,
    inboundNumber,
    voicemailUrl,
    zohoClientId,
    zohoClientSecret,
    zohoRefreshToken,
    zohoOrgId,
    zohoApiDomain,
  };
}

/**
 * @typedef {ReturnType<typeof getTenantConfig>} TenantConfig
 */
