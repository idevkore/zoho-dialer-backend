/**
 * Support / error report: opens mailto or external URL with lightweight diagnostics.
 * Override with window.__HAULOS_SUPPORT_URL__ (https…) or window.__HAULOS_SUPPORT_EMAIL__ (address only).
 * Company site: https://gethaulos.com
 */

import { getZohoOrgDiagnostics } from './zoho-context.js';

const HAULOS_WEB = 'https://gethaulos.com';
const DEFAULT_SUPPORT_EMAIL = 'support@gethaulos.com';

function visibleErrorText() {
  const el = document.getElementById('error-banner');
  if (!el || el.classList.contains('hidden')) return '';
  return el.textContent.replace(/\s+/g, ' ').trim();
}

/** @param {string} str @param {number} max */
function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

/** @param {string} label @param {unknown} obj @param {number} maxLen */
function jsonLine(label, obj, maxLen) {
  if (obj == null) return `${label}: (none)`;
  try {
    return `${label}: ${truncate(JSON.stringify(obj), maxLen)}`;
  } catch {
    return `${label}: (unserializable)`;
  }
}

/** @param {unknown} pl */
function summarizePageLoad(pl) {
  if (pl == null) return null;
  if (typeof pl !== 'object' || pl === null) return pl;
  const o = /** @type {Record<string, unknown>} */ (pl);
  const picked = {};
  for (const k of [
    'orgId',
    'organizationId',
    'organization_id',
    'zgid',
    'ZGID',
    'company_name',
    'CompanyName',
    'domainName',
    'domain',
    'locale',
    'currency',
    'entity',
    'Entity',
    'recordId',
    'RecordID',
    'extensionConfig',
    'widgetParams',
    'configParams',
  ]) {
    if (k in o && o[k] != null && o[k] !== '') picked[k] = o[k];
  }
  if (Object.keys(picked).length) return picked;
  return o;
}

/** @param {Record<string, unknown> | null} p */
function formatOrgParsedLines(p) {
  if (!p || typeof p !== 'object') return [];
  const lines = [];
  const keys = [
    'company_name',
    'CompanyName',
    'org_name',
    'organization_id',
    'zgid',
    'domain',
    'domainName',
    'currency',
    'country',
    'datacenter',
  ];
  for (const k of keys) {
    if (k in p && p[k] != null && String(p[k]).trim() !== '') {
      lines.push(`Zoho org · ${k}: ${p[k]}`);
    }
  }
  if (!lines.length) lines.push(jsonLine('Zoho org (parsed CONFIG)', p, 600));
  return lines;
}

/** @param {Record<string, unknown> | null} u */
function formatZohoUserLine(u) {
  if (!u) return 'Zoho CRM user (CONFIG): (unknown)';
  const role = u.role && typeof u.role === 'object' ? u.role.name ?? u.role.id : '';
  const profile = u.profile && typeof u.profile === 'object' ? u.profile.name ?? u.profile.id : '';
  const bits = [
    typeof u.email === 'string' ? u.email : '',
    u.id != null ? `id=${u.id}` : '',
    u.zuid != null ? `zuid=${u.zuid}` : '',
    u.full_name != null ? `name=${u.full_name}` : '',
    role ? `role=${role}` : '',
    profile ? `profile=${profile}` : '',
  ].filter(Boolean);
  return `Zoho CRM user (CONFIG): ${bits.join(' · ') || '(no fields)'}`;
}

async function collectDiagnosticsBody() {
  const tenant =
    typeof window.__HAULOS_TENANT_ID__ === 'string' ? window.__HAULOS_TENANT_ID__ : '(unknown)';
  const user =
    typeof window.__HAULOS_IDENTITY__ === 'string' && window.__HAULOS_IDENTITY__.trim()
      ? window.__HAULOS_IDENTITY__.trim()
      : '(unknown)';
  const state = document.getElementById('dialer-root')?.getAttribute('data-state') || '';
  const err = visibleErrorText();
  let ua = navigator.userAgent;
  if (ua.length > 220) ua = ua.slice(0, 217) + '…';

  let zohoBlock = ['— Zoho CRM org —', '(ZOHO SDK unavailable — e.g. local preview without CRM JS)'];
  try {
    const z = await getZohoOrgDiagnostics();
    zohoBlock = ['— Zoho CRM org —'];
    if (z.orgContent) {
      zohoBlock.push(`Zoho CONFIG.getOrgInfo Content: ${truncate(z.orgContent, 400)}`);
    }
    zohoBlock.push(...formatOrgParsedLines(z.orgParsed));
    zohoBlock.push(jsonLine('Zoho CONFIG.getOrgInfo() full response', z.orgApiResponse, 520));
    zohoBlock.push(formatZohoUserLine(z.currentUser));
    const pl = summarizePageLoad(z.pageLoad);
    zohoBlock.push(jsonLine('Zoho embeddedApp PageLoad snapshot (subset / truncated)', pl, 900));
  } catch (e) {
    zohoBlock.push(`Zoho org context error: ${e instanceof Error ? e.message : String(e)}`);
  }

  const lines = [
    '— HaulOS Zoho Dialer —',
    `Website: ${HAULOS_WEB}`,
    `HaulOS tenantId (install param): ${tenant}`,
    `Widget identity hint: ${user}`,
    '',
    ...zohoBlock,
    '',
    `Dialer UI state: ${state}`,
    err ? `Error banner: ${err}` : '',
    `Widget URL: ${window.location.href}`,
    `When: ${new Date().toISOString()}`,
    `UA: ${ua}`,
    '',
    '(Describe what happened below.)',
  ];
  return lines.filter(Boolean).join('\n');
}

async function buildMailtoHref() {
  const raw =
    typeof window.__HAULOS_SUPPORT_EMAIL__ === 'string' && window.__HAULOS_SUPPORT_EMAIL__.trim()
      ? window.__HAULOS_SUPPORT_EMAIL__.trim()
      : DEFAULT_SUPPORT_EMAIL;
  const email = raw.replace(/^mailto:/i, '').split('?')[0].trim();
  const subject = encodeURIComponent('HaulOS Zoho Dialer — support / error report');
  const body = encodeURIComponent(await collectDiagnosticsBody());
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/**
 * Wire the support control once DOM is available.
 */
export function initSupportButton() {
  const btn = document.getElementById('btn-support');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    const url =
      typeof window.__HAULOS_SUPPORT_URL__ === 'string' && window.__HAULOS_SUPPORT_URL__.trim()
        ? window.__HAULOS_SUPPORT_URL__.trim()
        : '';
    if (url) {
      if (/^mailto:/i.test(url)) {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    try {
      window.location.href = await buildMailtoHref();
    } catch (e) {
      console.error('[support-feedback]', e);
    }
  });
}
