import { createCallActivity, findContactIdByPhone } from './zohoService.js';

/**
 * In-memory recording URL keyed by CallSid (replace with DB / Zoho update flow later).
 * @type {Map<string, string>}
 */
const recordingByCallSid = new Map();

/**
 * Store latest recording URL for a call.
 * @param {string} callSid
 * @param {string} recordingUrl
 */
export function rememberRecordingUrl(callSid, recordingUrl) {
  if (callSid && recordingUrl) {
    recordingByCallSid.set(callSid, recordingUrl);
  }
}

/**
 * @param {string} callSid
 * @returns {string | undefined}
 */
export function getRecordingUrl(callSid) {
  return recordingByCallSid.get(callSid);
}

/**
 * Map Twilio status callback payload to Zoho call activity fields.
 * @param {Record<string, string | undefined>} payload
 * @param {import('../config/tenants.js').TenantConfig} tenantConfig
 */
function buildCallActivityFields(payload) {
  const durationSec = payload.CallDuration ? Number(payload.CallDuration) : undefined;
  const direction =
    payload.Direction === 'inbound'
      ? 'Inbound'
      : payload.Direction === 'outbound-api' || payload.Direction === 'outbound-dial'
        ? 'Outbound'
        : payload.Direction;

  return {
    Subject: `Call ${payload.CallStatus || 'update'}`,
    Call_Duration: Number.isFinite(durationSec) ? durationSec : undefined,
    Description: [
      `CallSid: ${payload.CallSid || ''}`,
      `From: ${payload.From || ''}`,
      `To: ${payload.To || ''}`,
      `Status: ${payload.CallStatus || ''}`,
    ]
      .filter(Boolean)
      .join('\n'),
    Call_Result: payload.CallStatus,
    Call_Direction: direction,
    Recording_URL: payload.RecordingUrl || getRecordingUrl(payload.CallSid || ''),
  };
}

/**
 * Log completed call to Zoho CRM (lookup contact + create Calls activity).
 * Never throws to callers; failures are logged.
 * @param {Record<string, string | undefined>} payload Twilio status callback body fields
 * @param {import('../config/tenants.js').TenantConfig} tenantConfig
 * @returns {Promise<void>}
 */
export async function logCompletedCallToZoho(payload, tenantConfig) {
  try {
    const phoneCandidate =
      payload.Direction === 'inbound' ? payload.From : payload.To || payload.From;

    const contactId = await findContactIdByPhone(phoneCandidate || '', tenantConfig);
    if (!contactId) {
      console.warn(
        `[callLogger] No Zoho Contact match for call ${payload.CallSid} (${phoneCandidate})`,
      );
      return;
    }

    const fields = buildCallActivityFields(payload);
    await createCallActivity(contactId, fields, tenantConfig);
    console.info(`[callLogger] Logged call ${payload.CallSid} to Zoho contact ${contactId}`);
  } catch (err) {
    console.error('[callLogger] Failed to log call to Zoho:', err);
  }
}
