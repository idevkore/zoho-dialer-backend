import { phoneSearchDigitVariants } from '../../src/services/zohoService.js';

describe('phoneSearchDigitVariants', () => {
  it('adds national 10 for US 11-digit 1-prefix', () => {
    expect(phoneSearchDigitVariants('17862669803')).toEqual(['17862669803', '7862669803']);
  });

  it('dedupes when input is already 10 digits', () => {
    expect(phoneSearchDigitVariants('7862669803')).toEqual(['7862669803']);
  });

  it('does not strip non-1 country codes', () => {
    expect(phoneSearchDigitVariants('447700900123')).toEqual(['447700900123']);
  });
});
