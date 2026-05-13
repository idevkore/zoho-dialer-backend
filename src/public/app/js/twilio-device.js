/**
 * Twilio Voice Device (global `Twilio` from CDN UMD build of @twilio/voice-sdk v2).
 */

/** @type {any} */
let device = null;

/** @type {any} */
let activeCall = null;

function getTwilio() {
  if (typeof window === 'undefined' || !window.Twilio || !window.Twilio.Device) {
    throw new Error('Twilio Voice SDK not loaded (Twilio.Device missing)');
  }
  return window.Twilio;
}

/**
 * @param {string} token Twilio capability token (JWT)
 * @param {{ onTokenWillExpire?: () => void }} [hooks]
 */
export async function init(token, hooks) {
  const Twilio = getTwilio();
  if (device) {
    try {
      device.destroy();
    } catch {
      /* ignore */
    }
    device = null;
    activeCall = null;
  }

  device = new Twilio.Device(token, {
    logLevel: 1,
    closeProtection: true,
  });

  device.on('registered', () => {
    console.info('[twilio-device] registered');
  });

  device.on('error', (error) => {
    console.error('[twilio-device] error', error);
    window.dispatchEvent(
      new CustomEvent('twilioDeviceError', {
        detail: { error },
      })
    );
  });

  device.on('incoming', (call) => {
    activeCall = call;
    bindCallLifecycle(call);
    window.dispatchEvent(
      new CustomEvent('incomingCall', {
        detail: { call },
      })
    );
  });

  device.on('tokenWillExpire', () => {
    if (hooks && typeof hooks.onTokenWillExpire === 'function') {
      hooks.onTokenWillExpire();
    }
  });

  await device.register();
  return device;
}

/**
 * @param {any} call
 */
function bindCallLifecycle(call) {
  call.on('disconnect', () => {
    if (activeCall === call) activeCall = null;
  });
  call.on('cancel', () => {
    if (activeCall === call) activeCall = null;
  });
  call.on('reject', () => {
    if (activeCall === call) activeCall = null;
  });
}

/**
 * @param {string} toNumber
 * @param {string} [fromNumber]
 * @param {string} tenantId
 */
export async function makeCall(toNumber, fromNumber, tenantId) {
  if (!device) throw new Error('Device not initialized');
  const params = {
    To: toNumber,
    TenantId: tenantId,
  };
  if (fromNumber) params.From = fromNumber;

  const call = await device.connect({ params });
  activeCall = call;
  bindCallLifecycle(call);
  return call;
}

export function hangUp() {
  const call = activeCall;
  if (call && typeof call.disconnect === 'function') {
    call.disconnect();
  }
  activeCall = null;
}

/**
 * @param {boolean} muted
 */
export function mute(muted) {
  const call = activeCall;
  if (call && typeof call.mute === 'function') {
    call.mute(!!muted);
  }
}

export function getDevice() {
  return device;
}

export function getActiveCall() {
  return activeCall;
}

/**
 * @param {string} newToken
 */
export async function updateToken(newToken) {
  if (!device) throw new Error('Device not initialized');
  if (typeof device.updateToken === 'function') {
    await device.updateToken(newToken);
  } else {
    console.warn('[twilio-device] updateToken not available on Device');
  }
}
