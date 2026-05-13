import twilio from 'twilio';

/**
 * Twilio REST helper bound to a tenant configuration.
 * TODO: Centralize credential resolution via Azure Key Vault before constructing clients.
 */
export class TwilioService {
  /**
   * @param {import('../config/tenants.js').TenantConfig} tenantConfig
   */
  constructor(tenantConfig) {
    this.tenantConfig = tenantConfig;
    this.client = TwilioService.getClient(tenantConfig);
  }

  /**
   * Build a Twilio REST client for the tenant.
   * @param {import('../config/tenants.js').TenantConfig} tenantConfig
   * @returns {import('twilio').Twilio}
   */
  static getClient(tenantConfig) {
    return twilio(tenantConfig.accountSid, tenantConfig.authToken);
  }

  /**
   * Redirect an in-progress call to new TwiML.
   * @param {string} callSid
   * @param {string} twimlUrl Absolute URL returning TwiML
   * @returns {Promise<unknown>}
   */
  async redirectCall(callSid, twimlUrl) {
    return this.client.calls(callSid).update({ url: twimlUrl, method: 'GET' });
  }
}
