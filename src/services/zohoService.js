import axios from 'axios';
import { URLSearchParams } from 'node:url';

/**
 * @typedef {import('../config/tenants.js').TenantConfig} TenantConfig
 */

const tokenCache = new Map();

/**
 * @param {string} tenantId
 * @returns {{ accessToken: string; expiresAtMs: number } | undefined}
 */
function cacheGet(tenantId) {
  return tokenCache.get(tenantId);
}

/**
 * @param {string} tenantId
 * @param {{ accessToken: string; expiresAtMs: number }} entry
 */
function cacheSet(tenantId, entry) {
  tokenCache.set(tenantId, entry);
}

/**
 * Refresh and cache Zoho OAuth access token for the tenant.
 * TODO: Back token storage with Azure Key Vault or a shared cache for multi-instance deployments.
 * @param {TenantConfig} tenantConfig
 * @returns {Promise<string>}
 */
export async function getAccessToken(tenantConfig) {
  const cached = cacheGet(tenantConfig.tenantId);
  if (cached && Date.now() < cached.expiresAtMs - 30_000) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: tenantConfig.zohoClientId,
    client_secret: tenantConfig.zohoClientSecret,
    refresh_token: tenantConfig.zohoRefreshToken,
  });

  const { data } = await axios.post('https://accounts.zoho.com/oauth/v2/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  if (data.error) {
    throw new Error(`Zoho token refresh failed: ${data.error} ${data.error_description || ''}`);
  }
  if (!data.access_token) {
    throw new Error('Zoho token refresh failed: missing access_token');
  }

  const expiresInSec = Number(data.expires_in || 3600);
  cacheSet(tenantConfig.tenantId, {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  });

  return data.access_token;
}

/**
 * Create a Calls activity in Zoho CRM.
 * @param {string} contactId Zoho Contact id
 * @param {Record<string, unknown>} callData Twilio-derived fields
 * @param {TenantConfig} tenantConfig
 * @returns {Promise<unknown>}
 */
export async function createCallActivity(contactId, callData, tenantConfig) {
  const accessToken = await getAccessToken(tenantConfig);
  const url = `${tenantConfig.zohoApiDomain}/crm/v8/Calls`;

  const payload = {
    data: [
      {
        Subject: callData.Subject ?? 'Phone call',
        Call_Duration: callData.Call_Duration,
        Description: callData.Description,
        Call_Result: callData.Call_Result,
        Who_Id: { id: contactId },
        Call_Direction: callData.Call_Direction,
        Recording_URL: callData.Recording_URL,
      },
    ],
  };

  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  });

  if (data?.data?.[0]?.code === 'SUCCESS') {
    return data;
  }
  if (data?.data?.[0]?.message) {
    throw new Error(`Zoho Calls create failed: ${data.data[0].message}`);
  }
  throw new Error(`Zoho Calls create failed: ${JSON.stringify(data).slice(0, 500)}`);
}

/**
 * Search Contacts by phone-ish string (best-effort across common fields).
 * @param {string} phone
 * @param {TenantConfig} tenantConfig
 * @returns {Promise<string | undefined>} Contact id if found
 */
export async function findContactIdByPhone(phone, tenantConfig) {
  if (!phone) return undefined;
  const accessToken = await getAccessToken(tenantConfig);
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;

  const criteria = `(Phone:equals:${digits})or(Mobile:equals:${digits})or(Phone:contains:${digits})or(Mobile:contains:${digits})`;
  const url = `${tenantConfig.zohoApiDomain}/crm/v8/Contacts/search`;

  const { data } = await axios.get(url, {
    params: { criteria },
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    validateStatus: () => true,
  });

  const id = data?.data?.[0]?.id;
  return typeof id === 'string' ? id : undefined;
}
