# zoho-dialer-backend

Multi-tenant Node.js backend for the Zoho CRM web dialer: Twilio Voice (tokens, TwiML, webhooks) and Zoho CRM call logging.

**GitHub:** `https://github.com/idevkore/zoho-dialer-backend` (default branch: **dev** — target for feature PRs)

## Branches

- **dev** — integration branch. Feature PRs merge here first; this is what you deploy to production for verification.
- **main** — after production testing passes, **main** is updated so it matches the functional production deployment (same commits that are live).

### Workflow

1. Open feature branches from **dev**, implement and test locally, then open PRs **into `dev`**.
2. Merge approved PRs to **dev** and deploy **dev** to production (Forge) for final verification.
3. Once production looks good, merge **`dev` → `main`**. **main** is then the canonical copy of what is running in production.
4. Merge **`main` → `dev`** so **dev** picks up that merge commit and stays aligned with production history.
5. Branch new features from **dev** again and repeat.

This keeps **main** trustworthy as “what shipped,” while **dev** stays the day-to-day integration line you branch from and PR into.

## Requirements

- Node.js 20+
- Twilio: Account SID, Auth Token, **API Key + Secret** (for Voice SDK access tokens), TwiML App SID, caller ID, optional inbound number and voicemail audio URL.
- Zoho CRM: OAuth client id/secret, refresh token, org id (per tenant, namespaced env vars).

Copy `.env.example` to `.env` and fill values. `JWT_SECRET` is required (used to sign short-lived TwiML URLs for voicemail drop).

**Zoho refresh token:** register a server-based OAuth client in [Zoho API Console](https://api-console.zoho.com/). The **`redirect_uri`** you register must **exactly match** what you send on the authorize URL and what this app sends when exchanging the `code` (see **`ZOHO_{TENANT}_REDIRECT_URI`** or the default `{PUBLIC_BASE_URL}/api/v1/zoho/oauth/callback`).

**Recommended — tenant via OAuth `state`:** add **`&state=kore`** (your tenant slug) to the **authorize** URL. Zoho returns it on the callback (`?state=kore&code=...&location=...`) — standard OAuth round-trip; this is what Zoho reliably echoes. The callback accepts **`state`** as the tenant slug when **`tenantId`** is absent (**`tenantId` wins** if both are set).

**Alternative:** append **`&tenantId=kore`** on the callback URL after redirect. Do **not** rely on putting **`tenantId`** only inside the registered **`redirect_uri`** — Zoho may omit it on the outbound redirect.

**Callback:** **`GET /api/v1/zoho/oauth/callback`** exchanges `code` for **`refresh_token`** → set **`ZOHO_{TENANT}_REFRESH_TOKEN`** in Forge.

### Zoho OAuth authorize URL (browser)

Visit **Zoho Accounts** (e.g. `accounts.zoho.com`, or `accounts.zoho.eu` for EU). Parameters: `response_type=code`, `access_type=offline`, `prompt=consent`, `client_id`, `scope`, **`redirect_uri`** (must match Zoho registration and **`ZOHO_{TENANT}_REDIRECT_URI`**), and **`state`** = tenant slug (e.g. **`kore`**).

**Verified example** — tenant carried with literal **`&state=kore`** at the end (only `redirect_uri`’s value is percent-encoded as one query component):

```
https://accounts.zoho.com/oauth/v2/auth?response_type=code&access_type=offline&prompt=consent&client_id=1000.341C3NUALS7F1G2VDFBN1THB98XD7C&scope=ZohoCRM.modules.ALL&redirect_uri=https%3A%2F%2Fhaulos-zoho-dialer-backend.atiny.cloud%2Fapi%2Fv1%2Fzoho%2Foauth%2Fcallback&state=kore
```

See [Zoho Accounts OAuth — authorization request](https://www.zoho.com/crm/developer/docs/api/v2.1/auth-request.html) for parameters and regional hosts.

## Twilio console URLs

Mount paths are under **`/api/v1`** (Forge/Nginx should forward to this app):

| Use | URL pattern |
| --- | --- |
| Health (use this if Nginx only proxies `/api`) | `https://<your-domain>/api/v1/health` |
| Health (root; needs Nginx to proxy `/` to Node) | `https://<your-domain>/health` |
| Voice (TwiML App) | `https://<your-domain>/api/v1/voice?tenantId=<slug>` |
| Status / recording callback | `https://<your-domain>/api/v1/events?tenantId=<slug>` |
| Inbound (number webhook) | `https://<your-domain>/api/v1/inbound` (tenant resolved via `TWILIO_*_INBOUND_NUMBER` match on `To`, or add `?tenantId=`). |
| Sample voicemail MP3 (bundled asset) | `https://<your-domain>/api/v1/voicemail-assets/default.mp3` (also `/voicemail-assets/default.mp3` if `/` is proxied to Node). |

In **production**, set `PUBLIC_BASE_URL` to the same origin Twilio uses (required for `X-Twilio-Signature` validation). In **non-production**, validation runs by default as well; set `SKIP_TWILIO_SIG_VALIDATION=true` to bypass signature checks while iterating on TwiML, or when Twilio hits a tunnel URL that does not match `PUBLIC_BASE_URL`. The Postman collection folder **📞 Twilio Webhooks** includes a pre-request script that recomputes `X-Twilio-Signature` from the resolved request URL and sorted form fields when you set the secret collection variable `twilioAuthToken` (your tenant’s Twilio Auth Token).

## Scripts

- `npm run dev` — nodemon
- `npm start` — production-style start
- `npm test` — Jest (ESM)

## Laravel Forge

Create the site from `idevkore/zoho-dialer-backend`, configure the **deploy branch** (e.g. `dev`), set environment variables in Forge (including `PORT`, `NODE_ENV`, `PUBLIC_BASE_URL`, `JWT_SECRET`, and tenant-prefixed secrets), and point Nginx at the Node process listening on `PORT`.

New Forge sites often use **zero-downtime deployments**. In that case the deploy script must use Forge’s release macros; a plain `git pull` in the site root will fail because there is no `.git` there. Example deploy script that works with this repo and **PM2** (`ecosystem.config.cjs` in the project root):

```bash
$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

npm ci --omit=dev

$ACTIVATE_RELEASE()

cd $FORGE_SITE_PATH

bash ./scripts/pm2-forge-resync.sh
```

Always run **`bash ./scripts/pm2-forge-resync.sh`** (or the equivalent `pm2 delete` + `pm2 start ecosystem.config.cjs`). **`pm2 restart` never re-reads `ecosystem.config.cjs`**, so if the app was ever started with a raw `node …/releases/<old>/src/server.js`, **`describe` will keep pointing at that old release** until you **delete** the process and **start** from the ecosystem file again.

### PM2 `describe` shows an old `releases/…` path

Compare:

```bash
readlink -f ~/haulos-zoho-dialer-backend.atiny.cloud/current
pm2 describe zoho-dialer-backend | grep -E 'script path|exec cwd'
```

If the **`releases/<id>`** in `describe` is **older** than `readlink -f current`, your Forge deploy script is still only **`pm2 restart`** (or never runs `delete` + `start` from **`current`**). Fix the deploy script to match the block above, deploy once, then re-check `describe`.

Forge defines **`$FORGE_SITE_PATH`** as the **deployment root**, which is already the `current` symlink (e.g. `/home/forge/example.com/current`). Do **not** append `/current` again or `cd` will fail with `.../current/current`. Use **`$FORGE_SITE_ROOT`** for the parent directory (e.g. `/home/forge/example.com`) when you need the site home without `current`.

Run **PM2 only after** `$ACTIVATE_RELEASE()` from **`$FORGE_SITE_PATH`** so `ecosystem.config.cjs` and shared files resolve against the activated release.

### 502 and nothing on port 3000

**Note:** `$FORGE_SITE_PATH` and `$FORGE_SITE_ROOT` exist **only while Forge runs the deploy script**. In normal SSH they are usually **empty** — do not use them in `tail`/`grep` by hand unless you `export` them yourself.

1. Confirm **Nginx** `proxy_pass` uses the same port as **`PORT`** in the site `.env`. From the server (site root is the parent of `current`):

   ```bash
   grep ^PORT= ~/haulos-zoho-dialer-backend.atiny.cloud/.env
   ss -tlnp | grep node
   ```

   (Adjust the `.env` path to your site directory if different.)

2. **PM2 logs** — after a successful **`pm2-forge-resync`**, this repo uses:

   ```bash
   tail -n 100 ~/.pm2/logs/zoho-dialer-backend.stderr.log
   tail -n 100 ~/.pm2/logs/zoho-dialer-backend.stdout.log
   ```

   If **`pm2 describe`** still shows **`zoho-dialer-backend-error-0.log`** / **`out-0.log`**, the process was **never** recreated with the current `ecosystem.config.cjs` (stuck on an old `pm2 start` registration). Run **`bash ./scripts/pm2-forge-resync.sh`** from **`current`**, then tail the **`.stderr.log` / `.stdout.log`** paths again (or use whatever paths `describe` prints).

   ```bash
   pm2 logs zoho-dialer-backend --lines 200 --nostream
   ```

3. In Forge **Daemons**, ensure you are **not** also running a second Node command for the same app that conflicts with PM2.

### PM2: first-time start or reload ecosystem

After changing `ecosystem.config.cjs`, recreate the process so PM2 picks up `cwd`, env, and log paths:

```bash
cd ~/YOUR_SITE/current
bash ./scripts/pm2-forge-resync.sh
```

To stream logs without remembering filenames:

```bash
pm2 logs zoho-dialer-backend --lines 200 --nostream
```

If you use **standard** (non–zero-downtime) deployments instead, use `git pull` / `git reset --hard` from `$FORGE_SITE_ROOT` and the same `npm ci` + PM2 lines from the directory that contains your app code and `ecosystem.config.cjs`.

### Nginx: proxy to Node

If the site Nginx config only has `try_files` under `location /`, **no traffic reaches Express**. Add a `location` that forwards **`/api/`** to the same **`PORT`** as in the site `.env` / Forge environment (replace `3000` below if different). Put this **above** the generic `location /` block so `/api/...` is handled first:

```nginx
location /api/ {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_pass http://127.0.0.1:3000;
}
```

Use `proxy_pass http://127.0.0.1:3000` **without** a URI path so the upstream receives the full path (e.g. `/api/v1/health`). If you also need **`GET /health`** at the site root, add a second block:

```nginx
location = /health {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000;
}
```

After editing, reload Nginx on the server (`sudo nginx -t && sudo service nginx reload`) or use Forge’s **Reload Nginx** if available.
