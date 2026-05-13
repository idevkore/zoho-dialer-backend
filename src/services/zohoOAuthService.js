import axios from 'axios';
import { URLSearchParams } from 'node:url';

/**
 * Exchange a one-time Zoho authorization `code` for access + refresh tokens.
 * @param {{
 *   code: string;
 *   clientId: string;
 *   clientSecret: string;
 *   redirectUri: string;
 *   accountsDomain: string;
 * }} params
 * @returns {Promise<Record<string, unknown>>}
 */
export async function exchangeZohoAuthorizationCode(params) {
  const {
    code,
    clientId,
    clientSecret,
    redirectUri,
    accountsDomain,
  } = params;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const tokenUrl = `${accountsDomain.replace(/\/$/, '')}/oauth/v2/token`;
  const { data } = await axios.post(tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
  });

  if (data.error) {
    throw new Error(
      `Zoho authorization code exchange failed: ${data.error} ${data.error_description || ''}`,
    );
  }
  if (!data.refresh_token) {
    throw new Error(
      'Zoho response missing refresh_token (ensure the authorize URL used access_type=offline and prompt=consent where applicable)',
    );
  }

  return data;
}
