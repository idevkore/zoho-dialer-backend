# zoho-dialer-backend

Multi-tenant Node.js backend for the Zoho CRM web dialer: Twilio Voice (tokens, TwiML, webhooks) and Zoho CRM call logging.

**GitHub:** `https://github.com/idevkore/zoho-dialer-backend` (default branch: **dev**)

## Branches

- **main** — matches what is successfully deployed to production.
- **dev** — default integration branch. Merge here and branch from here for feature work.

Flow: feature branches → **dev** → when release-ready, merge **dev** → **main**.

## Requirements

- Node.js 20+
- Twilio: Account SID, Auth Token, **API Key + Secret** (for Voice SDK access tokens), TwiML App SID, caller ID, optional inbound number and voicemail audio URL.
- Zoho CRM: OAuth client id/secret, refresh token, org id (per tenant, namespaced env vars).

Copy `.env.example` to `.env` and fill values. `JWT_SECRET` is required (used to sign short-lived TwiML URLs for voicemail drop).

## Twilio console URLs

Mount paths are under **`/api/v1`** (Forge/Nginx should forward to this app):

| Use | URL pattern |
| --- | --- |
| Voice (TwiML App) | `https://<your-domain>/api/v1/voice?tenantId=<slug>` |
| Status / recording callback | `https://<your-domain>/api/v1/events?tenantId=<slug>` |
| Inbound (number webhook) | `https://<your-domain>/api/v1/inbound` (tenant resolved via `TWILIO_*_INBOUND_NUMBER` match on `To`, or add `?tenantId=`). |

In **production**, set `PUBLIC_BASE_URL` to the same origin Twilio uses (required for `X-Twilio-Signature` validation).

## Scripts

- `npm run dev` — nodemon
- `npm start` — production-style start
- `npm test` — Jest (ESM)

## Laravel Forge

Create the site from `idevkore/zoho-dialer-backend`, set environment variables in Forge, deploy command `npm ci && npm start` (or your PM2/foreman setup), and map the daemon/web process to `node src/server.js` on the configured `PORT`.
