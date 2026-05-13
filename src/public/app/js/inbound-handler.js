/**
 * Inbound call handling: listens for `incomingCall` from twilio-device.js.
 */

/** @type {ReturnType<typeof setTimeout> | null} */
let autoRejectTimer = null;

/** @type {any} */
let pendingCall = null;

/** @type {((call: any) => void) | null} */
let onIncoming = null;

function clearAutoReject() {
  if (autoRejectTimer != null) {
    clearTimeout(autoRejectTimer);
    autoRejectTimer = null;
  }
}

function scheduleAutoReject() {
  clearAutoReject();
  autoRejectTimer = window.setTimeout(() => {
    const call = pendingCall;
    if (!call) return;
    try {
      if (typeof call.reject === 'function') call.reject();
    } catch (e) {
      console.warn('[inbound-handler] auto-reject', e);
    }
    pendingCall = null;
    window.dispatchEvent(new CustomEvent('inboundCallTimeout'));
  }, 30_000);
}

function onIncomingCallEvent(/** @type {Event} */ ev) {
  /** @type {{ call?: any }} */
  const detail = /** @type {CustomEvent} */ (ev).detail || {};
  const call = detail.call;
  if (!call) return;

  pendingCall = call;
  scheduleAutoReject();
  if (typeof onIncoming === 'function') onIncoming(call);
}

/**
 * @param {{ onIncomingCall: (call: any) => void }} opts
 */
export function init(opts) {
  onIncoming = opts.onIncomingCall;
  window.addEventListener('incomingCall', onIncomingCallEvent);
}

export function destroy() {
  window.removeEventListener('incomingCall', onIncomingCallEvent);
  clearAutoReject();
  pendingCall = null;
  onIncoming = null;
}

/**
 * @param {any} call
 * @returns {string}
 */
export function getInboundCallerId(call) {
  try {
    const p = call.parameters || {};
    return (
      p.From ||
      p.Caller ||
      p.CallerId ||
      p.RemoteIdentity ||
      'Unknown'
    );
  } catch {
    return 'Unknown';
  }
}

export function acceptPending() {
  const call = pendingCall;
  if (!call) return;
  clearAutoReject();
  try {
    if (typeof call.accept === 'function') call.accept();
  } catch (e) {
    console.error('[inbound-handler] accept', e);
  }
  pendingCall = null;
}

export function rejectPending() {
  const call = pendingCall;
  if (!call) return;
  clearAutoReject();
  try {
    if (typeof call.reject === 'function') call.reject();
  } catch (e) {
    console.warn('[inbound-handler] reject', e);
  }
  pendingCall = null;
}

export function getPendingCall() {
  return pendingCall;
}
