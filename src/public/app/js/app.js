/**
 * HaulOS Twilio softphone — entry point.
 * Waits for CRM PageLoad, resolves tenantId, provisions Twilio Device, binds UI.
 */

import * as TokenService from './token-service.js';
import * as TwilioLayer from './twilio-device.js';
import * as CallControls from './call-controls.js';
import * as ZohoCtx from './zoho-context.js';
import { initSupportButton } from './support-feedback.js';

/** @type {boolean} */
let dialerReady = false;

/** CRM click-to-dial received before Twilio/bootstrap finished (last number wins). */
let pendingCrmDial = null;

/** @type {Promise<unknown> | null} */
let embeddedInitPromise = null;

/** @type {Promise<void>} */
let bootChain = Promise.resolve();

/**
 * @param {string} num
 */
function queueOrDialFromCrm(num) {
  const s = String(num || '').trim();
  if (!s) return;
  if (dialerReady) {
    void CallControls.dialOutboundFromExternal(s);
  } else {
    pendingCrmDial = s;
  }
}

/**
 * Ensure ZOHO.embeddedApp.init() has completed (required before CONFIG.getVariable).
 * @returns {Promise<unknown>}
 */
function ensureEmbeddedInit() {
  const Z = window.ZOHO;
  if (!Z?.embeddedApp?.init) return Promise.resolve();
  if (!embeddedInitPromise) {
    embeddedInitPromise = Promise.resolve(Z.embeddedApp.init());
  }
  return embeddedInitPromise;
}

async function getIdentity() {
  try {
    const Z = window.ZOHO;
    if (!Z?.CRM?.CONFIG?.getCurrentUser) return '';
    const r = await Z.CRM.CONFIG.getCurrentUser();
    const u = r && r.users && r.users[0];
    if (!u) return '';
    return String(u.email || u.id || u.zuid || '');
  } catch (e) {
    console.warn('[app] getCurrentUser', e);
    return '';
  }
}

/**
 * Prefill dial input when a single phone exists on the current record (best-effort).
 */
async function prefillFromCurrentRecord() {
  try {
    const rec = await ZohoCtx.getCurrentRecord();
    if (!rec) return;
    const phones = ZohoCtx.getPhoneNumbers(rec);
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById('dial-input'));
    if (input && phones.length === 1) input.value = phones[0];
  } catch (e) {
    console.warn('[app] prefill record', e);
  }
}

/**
 * @param {unknown} _pageData reserved (PageLoad payload); tenant comes from CRM variable.
 */
async function bootstrapDialer(_pageData) {
  if (dialerReady) return;

  await ensureEmbeddedInit();
  const tenantId = await ZohoCtx.loadTenantIdFromCrmVariable();
  window.__HAULOS_TENANT_ID__ = tenantId;

  const identity = await getIdentity();
  window.__HAULOS_IDENTITY__ = identity;

  const token = await TokenService.fetchToken(tenantId, identity || undefined);

  await TwilioLayer.init(token, {
    onTokenWillExpire: async () => {
      const next = await TokenService.fetchToken(tenantId, identity || undefined);
      await TwilioLayer.updateToken(next);
      TokenService.clearScheduledRefresh();
      TokenService.scheduleTokenRefresh(
        next,
        async (t2) => {
          await TwilioLayer.updateToken(t2);
        },
        (err) => console.error('[app] token refresh', err)
      );
    },
  });

  TokenService.scheduleTokenRefresh(
    token,
    async (newTok) => {
      await TwilioLayer.updateToken(newTok);
    },
    (err) => console.error('[app] scheduled token refresh', err)
  );

  CallControls.setupInboundUi(tenantId);
  CallControls.bindControls(tenantId);

  await prefillFromCurrentRecord();

  dialerReady = true;
  CallControls.setState('ready');

  if (pendingCrmDial) {
    const queued = pendingCrmDial;
    pendingCrmDial = null;
    await CallControls.dialOutboundFromExternal(queued);
  }
}

/**
 * @param {unknown} pageData
 */
function enqueueBootstrap(pageData) {
  bootChain = bootChain
    .then(async () => {
      if (dialerReady) return;
      await bootstrapDialer(pageData);
    })
    .catch((e) => {
      console.error('[app] bootstrap', e);
      CallControls.setState('error', { message: e instanceof Error ? e.message : String(e) });
    });
  return bootChain;
}

/**
 * Initialize the embedded app and bootstrap the dialer once context is available.
 */
export async function init() {
  const root = document.getElementById('dialer-root');
  if (!root) {
    console.error('[app] #dialer-root missing');
    return;
  }

  initSupportButton();

  if (!window.ZOHO?.embeddedApp) {
    CallControls.setState('error', {
      message:
        'ZOHO.embeddedApp not found. This HTML must run inside Zoho CRM’s widget iframe (local zet preview does not inject the CRM JS SDK).',
    });
    return;
  }

  const Z = window.ZOHO;
  Z.embeddedApp.on('PageLoad', (data) => {
    window.__HAULOS_LAST_PAGELOAD__ = data;
    enqueueBootstrap(data);
  });

  ZohoCtx.watchForPhoneClicks((num) => queueOrDialFromCrm(num));

  await ensureEmbeddedInit();

  window.setTimeout(() => {
    enqueueBootstrap({});
  }, 2000);
}
