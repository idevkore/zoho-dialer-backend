/**
 * Twilio capability token from HaulOS backend.
 * Base path: https://haulos-zoho-dialer-backend.atiny.cloud/api/v1
 */

const DEFAULT_BASE = 'https://haulos-zoho-dialer-backend.atiny.cloud/api/v1';

/** @type {number | null} */
let refreshTimerId = null;

function getBackendBase() {
  return (typeof window !== 'undefined' && window.__HAULOS_API_BASE__) || DEFAULT_BASE;
}

/**
 * Decode JWT `exp` (seconds since epoch) from an unverified token payload.
 * @param {string} token
 * @returns {number | null} expiry time in ms, or null
 */
function getJwtExpiryMs(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string} tenantId
 * @param {string} [identity] optional CRM user id / email for auditing
 * @returns {Promise<string>} Twilio capability JWT
 */
export async function fetchToken(tenantId, identity) {
  const base = getBackendBase().replace(/\/$/, '');
  const url = `${base}/token`;
  const headers = {
    Accept: 'application/json',
    'X-Tenant-ID': tenantId,
  };
  if (identity) {
    headers['X-Identity'] = identity;
  }

  const res = await fetch(url, { method: 'GET', headers, credentials: 'omit' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token HTTP ${res.status}: ${text || res.statusText}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (data && typeof data.token === 'string') return data.token;
    if (data && typeof data.jwt === 'string') return data.jwt;
    throw new Error('Token JSON missing "token" or "jwt"');
  }

  const raw = (await res.text()).trim();
  if (!raw) throw new Error('Empty token response');
  return raw;
}

/**
 * Schedule a refresh ~30s before JWT expiry. Falls back to 50 minutes if exp cannot be read.
 * @param {string} token
 * @param {(newToken: string) => void} onRefresh
 * @param {(err: Error) => void} [onError]
 */
export function scheduleTokenRefresh(token, onRefresh, onError) {
  clearScheduledRefresh();
  const expMs = getJwtExpiryMs(token);
  const skewMs = 30_000;
  const fallbackMs = 50 * 60 * 1000;
  const delay = expMs ? Math.max(10_000, expMs - Date.now() - skewMs) : fallbackMs;

  refreshTimerId = window.setTimeout(async () => {
    try {
      const tenantId = window.__HAULOS_TENANT_ID__;
      if (!tenantId) throw new Error('Missing tenant for token refresh');
      const next = await fetchToken(tenantId, window.__HAULOS_IDENTITY__);
      onRefresh(next);
      scheduleTokenRefresh(next, onRefresh, onError);
    } catch (e) {
      if (onError) onError(e instanceof Error ? e : new Error(String(e)));
    }
  }, delay);
}

export function clearScheduledRefresh() {
  if (refreshTimerId != null) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}
