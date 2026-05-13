/**
 * Zoho CRM page context for floating telephony widget.
 *
 * Limitations (floating vs record-embedded):
 * - Floating widgets load globally; `ZOHO.CRM.INTERACTION.getPageInfo()` reflects the
 *   active CRM UI route when supported. On some routes (list views, settings) there may
 *   be no single "current record" — APIs can return empty or partial data.
 * - `ZOHO.CRM.UI` phone-field click hooks are inconsistent for floating telephony; the
 *   reliable CRM integration path is `ZOHO.embeddedApp.on("Dial", ...)` (see watchForPhoneClicks).
 */

const PHONE_FIELD_HINTS = /phone|mobile|fax|tel/i;

/** Zoho Sigma CRM variable (Custom Property) for tenant routing. */
export const HAULOS_TENANT_CRM_VARIABLE = 'haulosdialerwidget__tenantId';

const DEFAULT_TENANT_FALLBACK = 'kore';

/**
 * Read tenantId from Zoho CRM CONFIG variable (Connected App / Sigma).
 * On missing value, empty value, or API failure, falls back to `kore` and logs a warning.
 * @returns {Promise<string>}
 */
export function loadTenantIdFromCrmVariable() {
  const Z = window.ZOHO;
  const warnAndFallback = () => {
    console.warn('[haulos] tenantId CRM variable not set, falling back to default: kore');
    return DEFAULT_TENANT_FALLBACK;
  };

  if (!Z || !Z.CRM || !Z.CRM.CONFIG || typeof Z.CRM.CONFIG.getVariable !== 'function') {
    return Promise.resolve(warnAndFallback());
  }

  return Promise.resolve(Z.CRM.CONFIG.getVariable(HAULOS_TENANT_CRM_VARIABLE))
    .then((resp) => {
      try {
        const root = resp && typeof resp === 'object' ? /** @type {Record<string, unknown>} */ (resp) : null;
        const variables =
          root && root.Variables && typeof root.Variables === 'object'
            ? /** @type {Record<string, unknown>} */ (root.Variables)
            : null;
        const node =
          variables && Object.prototype.hasOwnProperty.call(variables, HAULOS_TENANT_CRM_VARIABLE)
            ? variables[HAULOS_TENANT_CRM_VARIABLE]
            : null;
        const raw =
          node && typeof node === 'object' && node !== null && 'value' in node
            ? /** @type {{ value?: unknown }} */ (node).value
            : undefined;
        const str = raw == null ? '' : String(raw).trim();
        if (str) return str;
      } catch {
        /* fall through to fallback */
      }
      return warnAndFallback();
    })
    .catch(() => warnAndFallback());
}

/**
 * @returns {Promise<{ Entity?: string; RecordID?: string; [k: string]: unknown } | null>}
 */
export async function getPageInfo() {
  try {
    if (!window.ZOHO || !ZOHO.CRM || !ZOHO.CRM.INTERACTION || !ZOHO.CRM.INTERACTION.getPageInfo) {
      return null;
    }
    const res = await ZOHO.CRM.INTERACTION.getPageInfo();
    if (res && res.status === 1 && res.data) return res.data;
    return res && res.data ? res.data : null;
  } catch (e) {
    console.warn('[zoho-context] getPageInfo', e);
    return null;
  }
}

/**
 * Fetch full record for the entity on the current page (when RecordID is known).
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getCurrentRecord() {
  const info = await getPageInfo();
  if (!info || !info.Entity || !info.RecordID) return null;

  try {
    const Z = window.ZOHO;
    if (!Z || !Z.CRM || !Z.CRM.API || !Z.CRM.API.getRecord) return null;
    const res = await Z.CRM.API.getRecord({
      Entity: info.Entity,
      RecordID: String(info.RecordID),
    });
    if (res && res.status === 1 && res.data && res.data.length) {
      return res.data[0];
    }
    return null;
  } catch (e) {
    console.warn('[zoho-context] getRecord', e);
    return null;
  }
}

/**
 * Heuristic: collect string values from fields whose API name suggests a phone.
 * @param {Record<string, unknown>} record
 * @returns {string[]}
 */
export function getPhoneNumbers(record) {
  if (!record || typeof record !== 'object') return [];
  const out = [];
  for (const [key, val] of Object.entries(record)) {
    if (!PHONE_FIELD_HINTS.test(key)) continue;
    if (typeof val === 'string' && val.trim()) out.push(val.trim());
  }
  return out;
}

/**
 * @param {string} phoneNumber
 */
export function triggerClickToDial(phoneNumber) {
  const el = /** @type {HTMLInputElement | null} */ (document.getElementById('dial-input'));
  if (el) {
    el.value = phoneNumber;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  window.dispatchEvent(
    new CustomEvent('haulosDialNumber', {
      detail: { phoneNumber },
    })
  );
}

/**
 * Normalize Zoho CRM `Dial` event payload to a single dialable string.
 * @param {unknown} data
 * @returns {string}
 */
export function extractDialNumberFromCrmEvent(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data.trim();
  if (typeof data !== 'object') return '';

  const tryRecord = (o) => {
    if (!o || typeof o !== 'object') return '';
    const d = /** @type {Record<string, unknown>} */ (o);
    const keys = [
      'Number',
      'Phone',
      'phone',
      'number',
      'PhoneNumber',
      'phoneNumber',
      'E164',
      'e164',
      'To',
      'to',
      'Mobile',
      'mobile',
      'Tel',
      'tel',
    ];
    for (const k of keys) {
      const v = d[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    return '';
  };

  const direct = tryRecord(data);
  if (direct) return direct;

  const nested = /** @type {Record<string, unknown>} */ (data);
  const inner = nested.data ?? nested.Data ?? nested.payload;
  return tryRecord(inner);
}

/**
 * Subscribe to CRM-initiated dial actions (phone icon / click-to-dial).
 * Register before `ZOHO.embeddedApp.init()` so early clicks are not dropped.
 * @param {(phone: string, meta?: unknown) => void} onDial
 */
export function watchForPhoneClicks(onDial) {
  const Z = window.ZOHO;
  if (!Z || !Z.embeddedApp || typeof Z.embeddedApp.on !== 'function') {
    console.warn(
      '[zoho-context] watchForPhoneClicks: embeddedApp not available (expected outside CRM iframe)'
    );
    return;
  }

  Z.embeddedApp.on('Dial', (data) => {
    const num = extractDialNumberFromCrmEvent(data);
    if (num) {
      onDial(num, data);
      return;
    }
    console.warn('[zoho-context] Dial event had no recognizable number', data);
  });
}

/**
 * Best-effort Zoho CRM org + user context for support diagnostics (mail body, logs).
 * @returns {Promise<{
 *   orgApiResponse: unknown;
 *   orgContent: string;
 *   orgParsed: Record<string, unknown> | null;
 *   currentUser: Record<string, unknown> | null;
 *   pageLoad: unknown;
 * }>}
 */
export async function getZohoOrgDiagnostics() {
  const out = {
    orgApiResponse: /** @type {unknown} */ (null),
    orgContent: '',
    orgParsed: /** @type {Record<string, unknown> | null} */ (null),
    currentUser: /** @type {Record<string, unknown> | null} */ (null),
    pageLoad: typeof window !== 'undefined' ? window.__HAULOS_LAST_PAGELOAD__ : null,
  };

  try {
    const Z = window.ZOHO;
    if (!Z?.CRM?.CONFIG) return out;

    if (typeof Z.CRM.CONFIG.getOrgInfo === 'function') {
      const orgRes = await Z.CRM.CONFIG.getOrgInfo();
      out.orgApiResponse = orgRes;
      const root = orgRes && typeof orgRes === 'object' ? /** @type {Record<string, unknown>} */ (orgRes) : null;
      const success =
        root && root.Success && typeof root.Success === 'object' ? root.Success : null;
      const c =
        success && 'Content' in success
          ? success.Content
          : root && 'Content' in root
            ? root.Content
            : null;
      if (c != null && c !== '') {
        if (typeof c === 'string') {
          out.orgContent = c.trim();
          try {
            const parsed = JSON.parse(c);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              out.orgParsed = /** @type {Record<string, unknown>} */ (parsed);
            }
          } catch {
            /* plain string org id or opaque token */
          }
        } else {
          out.orgContent = String(c);
        }
      }
    }

    if (typeof Z.CRM.CONFIG.getCurrentUser === 'function') {
      const ur = await Z.CRM.CONFIG.getCurrentUser();
      const u =
        ur && typeof ur === 'object' && Array.isArray(/** @type {any} */ (ur).users)
          ? /** @type {any} */ (ur).users[0]
          : ur;
      if (u && typeof u === 'object') {
        out.currentUser = /** @type {Record<string, unknown>} */ (u);
      }
    }
  } catch (e) {
    console.warn('[zoho-context] getZohoOrgDiagnostics', e);
  }

  return out;
}
