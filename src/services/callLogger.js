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
 * Twilio Voice status / recording callbacks: billed length (seconds).
 * @param {Record<string, string | undefined>} payload
 * @returns {number}
 */
export function getTwilioBilledDurationSec(payload) {
  const raw = payload.CallDuration ?? payload.DialCallDuration ?? '';
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Zoho CRM v8 Date/Time: `yyyy-MM-ddTHH:mm:ss±HH:mm` (no fractional seconds in docs).
 * @param {Date | number} date
 * @returns {string}
 */
export function formatDateTimeForZohoUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${da}T${h}:${mi}:${s}+00:00`;
}

/**
 * Zoho CRM Calls `Call_Duration` expects mm:ss (e.g. 10:00 = ten minutes).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatZohoCallDurationMmSs(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Zoho: Inbound/Outbound call duration cannot be 00:00 (insert-records Calls note).
 * @param {'Inbound' | 'Outbound' | 'Missed'} callType
 * @param {string} mmSs from {@link formatZohoCallDurationMmSs}
 * @returns {string}
 */
export function enforceZohoMinimumCallDuration(callType, mmSs) {
  if ((callType === 'Inbound' || callType === 'Outbound') && mmSs === '00:00') {
    return '00:01';
  }
  return mmSs;
}

/**
 * `Call_Start_Time` from Twilio `Timestamp` (RFC2822, status event time) minus billed duration when possible.
 * @param {Record<string, string | undefined>} payload
 * @returns {string} Zoho v8 Date/Time string (UTC offset)
 */
export function inferZohoCallStartTime(payload) {
  const durationSec = getTwilioBilledDurationSec(payload);
  const eventMs = payload.Timestamp ? Date.parse(payload.Timestamp) : NaN;
  if (!Number.isNaN(eventMs) && durationSec > 0) {
    return formatDateTimeForZohoUtc(eventMs - durationSec * 1000);
  }
  if (!Number.isNaN(eventMs)) {
    return formatDateTimeForZohoUtc(eventMs);
  }
  const now = Date.now();
  if (durationSec > 0) {
    return formatDateTimeForZohoUtc(now - durationSec * 1000);
  }
  return formatDateTimeForZohoUtc(now);
}

/**
 * Twilio → Zoho Calls mandatory fields:
 * - Subject ← CallStatus (or fallback)
 * - Call_Type ← Direction (inbound → Inbound, outbound* → Outbound; else Outbound)
 * - Call_Start_Time ← Timestamp − CallDuration (see inferZohoCallStartTime)
 * - Call_Duration ← CallDuration | DialCallDuration as mm:ss; Inbound/Outbound never 00:00
 *
 * @param {Record<string, string | undefined>} payload
 */
function buildCallActivityFields(payload) {
  const durationSec = getTwilioBilledDurationSec(payload);
  const dir = (payload.Direction || '').toLowerCase();
  const callType =
    dir === 'inbound'
      ? 'Inbound'
      : dir === 'outbound-api' || dir === 'outbound-dial' || dir === 'outbound'
        ? 'Outbound'
        : 'Outbound';

  const recordingUrl = payload.RecordingUrl || getRecordingUrl(payload.CallSid || '');

  const mmSs = enforceZohoMinimumCallDuration(
    callType,
    formatZohoCallDurationMmSs(durationSec),
  );

  return {
    Subject: `Call ${payload.CallStatus || 'update'}`,
    Call_Type: callType,
    Call_Start_Time: inferZohoCallStartTime(payload),
    Call_Duration: mmSs,
    Description: [
      `CallSid: ${payload.CallSid || ''}`,
      `From: ${payload.From || ''}`,
      `To: ${payload.To || ''}`,
      `Status: ${payload.CallStatus || ''}`,
    ]
      .filter(Boolean)
      .join('\n'),
    Outbound_Call_Status: callType === 'Outbound' ? 'Completed' : undefined,
    Recording_URL: recordingUrl && /^https?:\/\//i.test(recordingUrl) ? recordingUrl : undefined,
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
    const dir = (payload.Direction || '').toLowerCase();
    const phoneCandidate = dir === 'inbound' ? payload.From : payload.To || payload.From;

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

/**
 * CRM widget POST /api/v1/log: client-reported duration + optional current record (Contacts).
 * Resolves Contact by `zohoModule`/`zohoRecordId` when on Contacts, else phone search like Twilio flow.
 *
 * @param {Record<string, unknown>} body
 * @param {import('../config/tenants.js').TenantConfig} tenantConfig
 * @returns {Promise<void>}
 */
export async function logWidgetCallSummaryToZoho(body, tenantConfig) {
  try {
    const durationSec = Math.max(0, Math.floor(Number(body.duration) || 0));
    const direction = String(body.direction || 'outbound').toLowerCase();
    const toNumber = String(body.toNumber || '');
    const fromNumber = String(body.fromNumber || '');
    const callSid = String(body.callSid || '');
    const zohoModule = String(body.zohoModule || '').trim();
    const zohoRecordId = String(body.zohoRecordId || '').trim();

    let contactId;
    if (/^contacts$/i.test(zohoModule) && zohoRecordId) {
      contactId = zohoRecordId;
    } else {
      const phoneCandidate = direction === 'inbound' ? fromNumber : toNumber || fromNumber;
      contactId = await findContactIdByPhone(phoneCandidate, tenantConfig);
    }

    if (!contactId) {
      console.warn(
        `[callLogger] widget log: no Contact id (CallSid=${callSid || '-'} module=${zohoModule || '-'})`,
      );
      return;
    }

    const callType = direction === 'inbound' ? 'Inbound' : 'Outbound';
    const mmSs = enforceZohoMinimumCallDuration(callType, formatZohoCallDurationMmSs(durationSec));
    const startMs = durationSec > 0 ? Date.now() - durationSec * 1000 : Date.now();
    const recordingUrl = callSid ? getRecordingUrl(callSid) : undefined;

    const fields = {
      Subject: callSid ? `Call ${callSid}` : 'Call (widget)',
      Call_Type: callType,
      Call_Start_Time: formatDateTimeForZohoUtc(startMs),
      Call_Duration: mmSs,
      Description: [
        `CallSid: ${callSid}`,
        `From: ${fromNumber}`,
        `To: ${toNumber}`,
        `Direction: ${direction}`,
        zohoModule && zohoRecordId ? `CRM page: ${zohoModule}/${zohoRecordId}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      Outbound_Call_Status: callType === 'Outbound' ? 'Completed' : undefined,
      Recording_URL:
        recordingUrl && /^https?:\/\//i.test(recordingUrl) ? recordingUrl : undefined,
    };

    await createCallActivity(contactId, fields, tenantConfig);
    console.info(`[callLogger] widget log CallSid=${callSid || '-'} → Zoho contact ${contactId}`);
  } catch (err) {
    console.error('[callLogger] widget log failed:', err);
  }
}
