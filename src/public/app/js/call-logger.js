/**
 * Post call summaries to the backend. Never throws to the caller.
 */

const DEFAULT_BASE = 'https://haulos-zoho-dialer-backend.atiny.cloud/api/v1';

function getBackendBase() {
  return (typeof window !== 'undefined' && window.__HAULOS_API_BASE__) || DEFAULT_BASE;
}

/**
 * @param {object} callData
 */
export async function postCallLog(callData) {
  const base = getBackendBase().replace(/\/$/, '');
  const url = `${base}/log`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Tenant-ID': String(callData.tenantId || ''),
      },
      body: JSON.stringify(callData),
      credentials: 'omit',
    });
    if (!res.ok) {
      console.error('[call-logger] log failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[call-logger]', err);
  }
}
