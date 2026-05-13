import {
  enforceZohoMinimumCallDuration,
  formatDateTimeForZohoUtc,
  formatZohoCallDurationMmSs,
  getTwilioBilledDurationSec,
  inferZohoCallStartTime,
} from '../../src/services/callLogger.js';

describe('getTwilioBilledDurationSec', () => {
  it('reads CallDuration', () => {
    expect(getTwilioBilledDurationSec({ CallDuration: '47' })).toBe(47);
  });

  it('falls back to DialCallDuration', () => {
    expect(getTwilioBilledDurationSec({ DialCallDuration: '12' })).toBe(12);
  });

  it('prefers CallDuration when both set', () => {
    expect(
      getTwilioBilledDurationSec({ CallDuration: '30', DialCallDuration: '99' }),
    ).toBe(30);
  });
});

describe('formatZohoCallDurationMmSs', () => {
  it('formats 47 seconds as mm:ss', () => {
    expect(formatZohoCallDurationMmSs(47)).toBe('00:47');
  });

  it('formats 10 minutes', () => {
    expect(formatZohoCallDurationMmSs(600)).toBe('10:00');
  });
});

describe('enforceZohoMinimumCallDuration', () => {
  it('bumps 00:00 to 00:01 for Outbound', () => {
    expect(enforceZohoMinimumCallDuration('Outbound', '00:00')).toBe('00:01');
  });

  it('leaves 00:00 for Missed', () => {
    expect(enforceZohoMinimumCallDuration('Missed', '00:00')).toBe('00:00');
  });
});

describe('formatDateTimeForZohoUtc', () => {
  it('uses yyyy-MM-ddTHH:mm:ss+00:00 without milliseconds', () => {
    expect(formatDateTimeForZohoUtc(new Date('2026-05-13T15:20:30.123Z'))).toBe(
      '2026-05-13T15:20:30+00:00',
    );
  });
});

describe('inferZohoCallStartTime', () => {
  it('subtracts billed duration from Twilio Timestamp (UTC)', () => {
    const t = inferZohoCallStartTime({
      Timestamp: 'Wed, 13 May 2026 15:21:17 +0000',
      CallDuration: '47',
    });
    expect(t).toBe('2026-05-13T15:20:30+00:00');
  });
});
