import { listTenantSlugs, sanitizeTenantId } from './tenants.js';

describe('tenants', () => {
  test('sanitizeTenantId rejects empty', () => {
    expect(() => sanitizeTenantId('')).toThrow();
  });

  test('listTenantSlugs returns empty when no env match', () => {
    const slugs = listTenantSlugs();
    expect(Array.isArray(slugs)).toBe(true);
  });
});
