/**
 * Softphone UI + call state machine.
 */

import * as TwilioLayer from './twilio-device.js';
import * as CallLogger from './call-logger.js';
import * as Inbound from './inbound-handler.js';
import * as ZohoCtx from './zoho-context.js';

/** @typedef {'loading'|'ready'|'calling'|'ringing'|'in_call'|'error'} CallState */

const BACKEND = 'https://haulos-zoho-dialer-backend.atiny.cloud/api/v1';

/** @type {HTMLElement | null} */
let root = null;

/** @type {CallState} */
let state = 'loading';

/** @type {string} */
let tenantId = '';

/** @type {number | null} */
let timerId = null;

/** @type {number} */
let callStartMs = 0;

/** @type {boolean} */
let muted = false;

/** @type {{ direction: string; toNumber: string; fromNumber: string; callSid: string } | null} */
let logContext = null;

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function setVisible(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !show);
}

/**
 * @param {CallState} next
 * @param {{ message?: string }} [extra]
 */
export function setState(next, extra) {
  state = next;
  const r = root || document.getElementById('dialer-root');
  if (r) {
    r.dataset.state = next;
    r.classList.toggle('dialer--loading', next === 'loading');
    r.classList.toggle('dialer--error', next === 'error');
  }

  const statusText = document.getElementById('status-text');
  const err = document.getElementById('error-banner');

  const labels = {
    loading: 'Connecting…',
    ready: 'Ready',
    calling: 'Calling…',
    ringing: 'Incoming call',
    in_call: 'In call',
    error: 'Error',
  };
  if (statusText) statusText.textContent = labels[next] || next;

  if (err) {
    if (next === 'error' && extra && extra.message) {
      err.textContent = extra.message;
      err.classList.remove('hidden');
    } else if (next !== 'error') {
      err.classList.add('hidden');
    }
  }

  setVisible('timer-row', next === 'in_call');
  setVisible('panel-inbound', next === 'ringing');

  const mainPanel = document.getElementById('panel-main');
  if (mainPanel) mainPanel.classList.toggle('hidden', next === 'ringing');

  const hang = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-hangup'));
  const muteBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-mute'));
  const vmBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-vm-drop'));
  const callBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-call'));

  if (hang) hang.disabled = next !== 'in_call' && next !== 'calling';
  if (muteBtn) muteBtn.disabled = next !== 'in_call';
  if (vmBtn) vmBtn.disabled = next !== 'in_call';
  if (callBtn) callBtn.disabled = next === 'calling' || next === 'in_call' || next === 'ringing';

  const dialpad = document.getElementById('dialpad');
  if (dialpad) {
    /** @type {NodeListOf<HTMLButtonElement>} */
    const keys = dialpad.querySelectorAll('button');
    keys.forEach((b) => {
      b.disabled = next === 'calling' || next === 'in_call' || next === 'ringing';
    });
  }

  const input = /** @type {HTMLInputElement | null} */ (document.getElementById('dial-input'));
  if (input) {
    input.disabled = next === 'calling' || next === 'in_call' || next === 'ringing';
  }
}

function startTimer() {
  stopTimer();
  callStartMs = Date.now();
  const el = document.getElementById('call-timer');
  const tick = () => {
    const sec = Math.floor((Date.now() - callStartMs) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    if (el) el.textContent = `${mm}:${ss}`;
  };
  tick();
  timerId = window.setInterval(tick, 1000);
}

function stopTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function callDurationSec() {
  return Math.floor((Date.now() - callStartMs) / 1000);
}

/**
 * @param {any} call
 */
function attachCallSideEffects(call) {
  call.on('accept', () => {
    setState('in_call');
    startTimer();
    const disp = document.getElementById('callerid-display');
    if (disp) {
      try {
        disp.textContent =
          call.parameters.To || call.parameters.From || disp.textContent;
      } catch {
        /* ignore */
      }
    }
  });

  call.on('disconnect', async () => {
    stopTimer();
    const duration = callStartMs ? callDurationSec() : 0;
    muted = false;
    const muteBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('btn-mute'));
    if (muteBtn) {
      muteBtn.classList.remove('is-active');
      muteBtn.textContent = 'Mute';
    }

    const page = await ZohoCtx.getPageInfo();
    const mod = page && page.Entity ? String(page.Entity) : '';
    const rid = page && page.RecordID ? String(page.RecordID) : '';

    if (logContext) {
      await CallLogger.postCallLog({
        duration,
        direction: logContext.direction,
        toNumber: logContext.toNumber,
        fromNumber: logContext.fromNumber,
        callSid: logContext.callSid,
        zohoRecordId: rid,
        zohoModule: mod,
        tenantId,
      });
    }
    logContext = null;
    setState('ready');
  });

  call.on('cancel', () => {
    stopTimer();
    logContext = null;
    setState('ready');
  });
}

/**
 * @param {string} tid
 */
export function bindControls(tid) {
  tenantId = tid;
  window.__HAULOS_TENANT_ID__ = tid;
  window.__HAULOS_API_BASE__ = BACKEND;

  root = document.getElementById('dialer-root');
  const dialInput = /** @type {HTMLInputElement} */ ($('dial-input'));
  const callerId = $('callerid-display');

  document.getElementById('dialpad')?.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const digit = t.closest('[data-digit]')?.getAttribute('data-digit');
    if (!digit || state === 'calling' || state === 'in_call' || state === 'ringing') return;
    dialInput.value += digit;
  });

  $('btn-call').addEventListener('click', async () => {
    const raw = dialInput.value.trim();
    if (!raw || state !== 'ready') return;
    setState('calling');
    callerId.textContent = raw;
    logContext = {
      direction: 'outbound',
      toNumber: raw,
      fromNumber: '',
      callSid: '',
    };
    try {
      const call = await TwilioLayer.makeCall(raw, '', tenantId);
      try {
        logContext.callSid = call.parameters.CallSid || '';
      } catch {
        /* ignore */
      }
      attachCallSideEffects(call);
    } catch (e) {
      console.error(e);
      logContext = null;
      setState('error', { message: e instanceof Error ? e.message : String(e) });
      window.setTimeout(() => setState('ready'), 6000);
    }
  });

  $('btn-hangup').addEventListener('click', () => {
    TwilioLayer.hangUp();
  });

  $('btn-mute').addEventListener('click', () => {
    if (state !== 'in_call') return;
    muted = !muted;
    TwilioLayer.mute(muted);
    const muteBtn = /** @type {HTMLButtonElement} */ ($('btn-mute'));
    muteBtn.classList.toggle('is-active', muted);
    muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  });

  $('btn-vm-drop').addEventListener('click', async () => {
    const call = TwilioLayer.getActiveCall();
    let callSid = '';
    try {
      callSid = call && call.parameters ? call.parameters.CallSid || '' : '';
    } catch {
      /* ignore */
    }
    if (!callSid) {
      console.warn('[call-controls] voicemail drop skipped — no CallSid');
      return;
    }
    try {
      const res = await fetch(`${BACKEND.replace(/\/$/, '')}/voicemail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ callSid, tenantId }),
        credentials: 'omit',
      });
      if (!res.ok) console.error('[call-controls] voicemail', await res.text());
    } catch (err) {
      console.error('[call-controls] voicemail', err);
    }
  });

  $('btn-accept').addEventListener('click', () => {
    const call = Inbound.getPendingCall();
    if (!call) return;
    logContext = {
      direction: 'inbound',
      toNumber: '',
      fromNumber: Inbound.getInboundCallerId(call),
      callSid: '',
    };
    try {
      logContext.callSid = call.parameters.CallSid || '';
    } catch {
      /* ignore */
    }
    attachCallSideEffects(call);
    Inbound.acceptPending();
    const disp = $('callerid-display');
    disp.textContent = logContext.fromNumber;
  });

  $('btn-reject').addEventListener('click', () => {
    Inbound.rejectPending();
    setState('ready');
  });

  window.addEventListener('haulosDialNumber', (ev) => {
    const num = /** @type {CustomEvent} */ (ev).detail?.phoneNumber;
    if (num) dialInput.value = String(num);
  });

  window.addEventListener('twilioDeviceError', (ev) => {
    const err = /** @type {CustomEvent} */ (ev).detail?.error;
    const msg = err && err.message ? err.message : 'Twilio error';
    setState('error', { message: msg });
    window.setTimeout(() => setState('ready'), 6000);
  });

  window.addEventListener('inboundCallTimeout', () => {
    if (state === 'ringing') setState('ready');
  });
}

/**
 * @param {string} tid
 */
export function setupInboundUi(tid) {
  tenantId = tid;
  Inbound.init({
    onIncomingCall: (call) => {
      const from = Inbound.getInboundCallerId(call);
      const el = document.getElementById('inbound-caller');
      if (el) el.textContent = from;
      setState('ringing');
    },
  });
}

export function getState() {
  return state;
}
