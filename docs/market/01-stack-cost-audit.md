# Stack cost-surface audit

Read 2026-10-04. Code only: no account, console or `.env` was opened, so anything that depends on configuration is marked UNVERIFIED.

Repositories read:

- **backend**: this repo at `origin/dev` `f417d99`.
- **widget**: `zoho-dialer-widget`. Its `app/` is synced into this repo at `src/public/app/`, so widget paths below are given in this repo.
- **client site**: the first client's website and portal repo (`TMG.Web`, `develop`). It is where Zoho Voice, Twilio messaging, the AI texting and Netlify are used today.
- The HaulOS Zoho configuration repo, the HaulOS marketing site and the meeting agent were checked and add no metered usage beyond what is listed.

## How the stack was established

From the code, not from a list: every outside host the source calls, every SDK in a `package.json` or `composer.json`, and every setting the functions read. That gives Twilio (voice, messaging, Studio, Functions, Voice Insights, Lookup, WhatsApp, email), Zoho CRM, Zoho Voice, the Anthropic API, Netlify (functions, database, blobs, sign-in), the Meta Graph API, the client's Granot system, Laravel Forge, Railway and GitHub.

**SendBlue is not in the stack.** No repository has SendBlue code, a SendBlue setting or a SendBlue dependency, and it was canceled for the first client on 2026-08-27 (request-board card 48). It is removed from the model. The AI texting that exists runs on Twilio messaging and on the agents' Zoho Voice lines.

"Who pays" is the owner of the account the code is pointed at. For the dialer that is whichever Twilio account sits in `TWILIO_<slug>_ACCOUNT_SID` (`src/config/tenants.js:130`): Kore for the `kore` tenant, undecided for clients.

## Billable and metered events

| Tool | Where used | Meter | Who pays | Evidence |
| --- | --- | --- | --- | --- |
| Twilio Voice: browser leg, outbound | `src/public/app/js/twilio-device.js:92-104` (`device.connect`), `src/routes/token.js:28-39` (Voice grant on the TwiML app) | Voice SDK minutes, each call rounded up to a whole minute, billed from connect | Kore for `kore`; UNVERIFIED for clients | Code. Ring time is billed unless `answerOnBridge` is set, and it is not (`src/routes/voice.js:19-29`): UNVERIFIED against a bill |
| Twilio Voice: PSTN leg, outbound | `src/routes/voice.js:19-34` (`<Dial><Number>`) | Outbound minutes by destination, rounded up per call | Same | Code |
| Twilio Voice: recording | `src/routes/voice.js:21` (`record: 'record-from-answer'`) | Recorded minutes, plus storage per minute per month | Same | Code. Every outbound call is recorded. Nothing in the repo deletes a recording |
| Twilio Voice: inbound | `src/routes/inbound.js:21-22` (`<Dial><Client>agent`) | Inbound local minutes plus a browser leg | Same | Code. Not recorded. No `answerOnBridge`, no timeout, no voicemail fallback |
| Twilio numbers | `TWILIO_<slug>_CALLER_ID`, `TWILIO_<slug>_INBOUND_NUMBER` (`.env.example`) | Per number per month | Same | Config names only. Count per tenant UNVERIFIED |
| Twilio Voice: voicemail drop | `src/routes/voicemail.js:16-42`, `src/services/twilioService.js:31-33`, `src/public/app/js/call-controls.js:230-251` | No fee of its own. The call keeps billing voice minutes while the MP3 plays | Same | Code. The widget sends the browser leg's CallSid; redirecting that leg would play the message to the agent and drop the customer. UNVERIFIED: not tested |
| Twilio Voice: answering machine detection | Not used | Per call, when enabled | n/a | No `machineDetection` anywhere in `src/`. $0 today; the planned auto dialer would add it |
| Twilio Messaging Service + 10DLC (HaulOS) | Not in the backend or widget | Per segment, carrier fee per segment, brand and campaign registration, monthly campaign fee, number rental | Kore, when built | No `messages.create` and no Messaging Service in `src/`. Planned |
| Twilio Messaging (client site) | client site `twilio/studio/lead-qualification/build-flow.mjs:144,157,313`, `src/lib/twilio-studio-api.ts`, `netlify/functions/sms-inbound.js` | Per segment and carrier fee; Studio flow executions | The client's own Twilio account. Owner UNVERIFIED | Code. That account's 10DLC campaign is approved |
| Twilio Voice (client site lead lines) | client site `twilio/studio/inbound-lead-routing/build-flow.mjs:64-82`, `twilio/voicemail/functions/voice.js:21`, `voicemail.js:27-30` | Inbound minutes, forwarded outbound leg, recording, voicemail recording (120 s cap) | Same as above | Code. Recordings are deleted after 90 days (`src/lib/call-recordings.ts:94`, `netlify/functions/recording-retention.js`) |
| Zoho CRM API: dialer call log | `src/routes/events.js:40-44` → `src/services/callLogger.js:152-171` → `src/services/zohoService.js:157-184` (`Contacts/search`) and `:86-122` (`POST /Calls`) | API credits against the org's daily allowance: one search and one insert per completed call | Tenant (its Zoho org) | Code. Only Contacts are searched. There is no Leads lookup on `dev`, so a call to a lead is not logged at all |
| Zoho CRM API: widget call log | `src/public/app/js/call-controls.js:171` → `src/routes/widgetCallLog.js:23` → `src/services/callLogger.js:181-235` | Same two calls again; one if the agent is on a Contact page | Tenant | Code |
| Zoho CRM API: widget page reads | `src/public/app/js/zoho-context.js:66-98` (`getPageInfo`, `getRecord`) | UNVERIFIED whether embedded-app SDK reads draw API credits | Tenant | Code |
| Zoho OAuth refresh | `src/services/zohoService.js:35-69` | Not credits. Zoho rations refreshes | Tenant | Code. Cache is in memory, so every deploy or restart refreshes |
| Zoho CRM API: client site | client site `src/lib/zoho-crm.ts:433` (lead push), `:1016` (status search, from `netlify/functions/sms-campaigns.js:218` every minute), `:1179` (lead read before every text), `:1338` (call create), `:1061` (calendar read) | API credits | Tenant | Code |
| Zoho CRM licenses | n/a | Per user per month by edition | Tenant pays Zoho directly | UNVERIFIED. Reseller margin 0% until the partner application is approved |
| Zoho Voice: seats and minutes | n/a (the client's dialer) | Per user per month by plan; per-minute calls; number rental | Tenant pays Zoho directly | Request-board card 63: Solo tier, 2 users |
| Zoho Voice: texting | client site `src/lib/zoho-voice.ts:782` (send), `:518` and `:562` (log polls from every-minute functions) | Per message; a documented limit of 20 requests a minute shared by agents and automation (`zoho-voice.ts:425`) | Tenant | Code. Per-message rate UNVERIFIED |
| SendBlue | Not used | n/a | n/a | No code, setting or dependency anywhere. Dropped from the model |
| AI for texting: the model | client site `netlify/functions/qualify-intent.js:64,158` (small model, 300 output tokens, one call per answer in the qualification texts), `src/lib/appointment-setter.ts:27,462` (top-tier model, 4,000 output tokens, one call per reply) | Input and output tokens | UNVERIFIED (owner of the API key) | Code. The planned TAC middleware has no code yet |
| AI for texting: the texts | client site `twilio/studio/lead-qualification/build-flow.mjs` (Twilio Studio flow on the Messaging Service), `netlify/functions/sms-conversations.js:271` (replies from the agent's Zoho Voice line) | Twilio: per segment plus carrier fee. Zoho Voice: per message | The client's Twilio account; the client's Zoho Voice account | Code. There is no per-line AI texting fee anywhere in the stack |
| AI elsewhere in the client site | `src/lib/haulos-helper.ts:68,372` (help answers), `src/lib/whatsapp-todo.ts:143,546` (requests by WhatsApp) | Input and output tokens | UNVERIFIED | Code. Not part of any priced add-on: a platform cost |
| Twilio Voice Insights | client site `src/lib/call-sync.ts:824-828` → `src/lib/twilio-voice-api.ts:443-453` (a call summary for every tracked call, from a function that runs every 2 minutes) | Per minute of each call summarized | The client's Twilio account | Code. A surcharge on every lead-line minute |
| Twilio text-to-speech | client site `twilio/studio/inbound-lead-routing/build-flow.mjs:53`, `twilio/voicemail/functions/voicemail.js:10`, `recording-complete.js:45,64` (a premium voice) | Per use | Same | Code |
| Twilio Lookup | client site `scripts/qualify-backfill.mjs:101` (line type) | Per lookup | Same | Code. A script, run by hand |
| Twilio Studio and Functions | client site `twilio/studio/*` (2 flows), `twilio/voicemail/functions/*` | Flow executions; function invocations. Both have a free allowance | Same | Code |
| Twilio WhatsApp | client site `src/lib/whatsapp-team.ts:109` | Per conversation or template message | Same | Code. An internal request line, not a tenant feature |
| Twilio email | client site `src/lib/lead-email.ts:148` | Per email | Same | Code. Lead notices and helper emails |
| Meta Graph API | client site `src/lib/meta-graph.ts` | None | n/a | Lead forms. No charge |
| Granot | client site `src/lib/granot.ts` | The client's own subscription | Tenant | Not a HaulOS cost |
| Railway | meeting agent `railway.json` | Service hours | Kore | Internal tool. Not a tenant cost |
| Laravel Forge | `ecosystem.config.cjs`, `scripts/pm2-forge-resync.sh`, README "Laravel Forge" | Flat subscription per month | Kore | Plan UNVERIFIED |
| AWS EC2 (`dk-services`) | Same; one PM2 process, fork mode | Instance hours, disk, public IPv4, data out | Kore | Instance type and what else shares the server UNVERIFIED |
| GitHub | Org `idevkore`. No workflows in this repo. Client site has `ci.yml` and `deploy.yml` | Seats; Actions minutes on private repos | Kore | Org plan read 2026-10-04: Free, 1 seat. $0 today |
| Netlify (client site) | client site `netlify.toml` (8 scheduled functions, two every minute), `netlify/functions/*` | Credits: deploys, compute including database compute, bandwidth, requests | Kore | Measured 2026-10-01, not re-read: about 9,000 credits a month |
| Zoho Marketing Automation | No code | Plan by contact count; SMS extra | Tenant or Kore: undecided | Planned |
| Zoho Voice Auto Dialer | No code | Plan-gated; per user | Tenant | Planned |
| TAC middleware | No code or repo found | Hosting plus AI tokens | Kore | Planned |
| Azure App Service, Key Vault, Blob and Table Storage | No Terraform. Two TODO comments: `src/services/zohoService.js:31`, `src/services/twilioService.js:5` | Instance hours; vault operations; GB stored and operations | Kore | Planned |

## Paths that could cost more than expected

Ranked by exposure.

1. **Anyone can get a calling token.** `GET /api/v1/token` asks only for an `X-Tenant-ID` header (`src/routes/token.js:49`, `src/middleware/tenantResolver.js:9-16`). CORS is open to every origin (`src/server.js:81`). The slug is guessable: the widget falls back to `kore` (`src/public/app/js/zoho-context.js:27`). The TwiML then dials whatever `To` the caller sends, with no country or number-type check (`src/routes/voice.js:31-34`). Someone with the URL can place calls on the tenant's Twilio account. The only limit is the account's geographic permissions: UNVERIFIED. This is uncapped and is the one item that can turn a month's margin negative.
2. **Recordings are kept forever.** Every outbound call is recorded and nothing deletes one. Storage is billed per minute per month, so the cost grows with how long a tenant has been a customer, not with how much it calls this month. The client site already purges at 90 days; the dialer does not.
3. **Each call can be logged to Zoho twice.** The Twilio status callback and the widget both search and insert (`src/routes/events.js:40-44`, `src/public/app/js/call-controls.js:171`). That is two Calls records and up to four API calls per call, with no key to stop a duplicate. Whether both fire depends on the TwiML app's status-callback setting: UNVERIFIED.
4. **`POST /api/v1/log` is open.** It takes the same tenant header and nothing else (`src/routes/widgetCallLog.js:23`). Each request spends a Zoho search and an insert. A loop could use up a tenant's daily API allowance, which would also stop that tenant's other automations.
5. **`SKIP_TWILIO_SIG_VALIDATION=true` works in production.** `src/middleware/twilioWebhookAuth.js:4-10,36-38`. With it on, a forged `completed` event costs a Zoho search and insert and writes a false call record. Forged `/voice` and `/inbound` requests only return TwiML. Whether it is on in Forge today: UNVERIFIED.
6. **Short calls are billed as full minutes, on two legs.** Twilio rounds each leg up. With no `answerOnBridge` on the `<Dial>`, the browser leg is live while the phone rings, so a rep making 200 attempts a day would pay a browser-leg minute on most of them, answered or not. UNVERIFIED against a bill. Minutes per seat in the model are billed minutes, not talk time.
7. **Every seat is the same identity.** The widget sends the agent's identity in an `X-Identity` header (`src/public/app/js/token-service.js:49-51`); the route reads a query parameter (`src/routes/token.js:20-23`). So every browser registers as `agent` and an inbound call rings all of them. With no `answerOnBridge`, Twilio also answers the inbound call before an agent picks up, so an unanswered inbound call would be billed: UNVERIFIED against a bill.
8. **State lives in memory.** The recording-URL map is never cleared (`src/services/callLogger.js:7`) and the Zoho token cache is per process (`src/services/zohoService.js:11`). A second instance, or frequent deploys, multiplies token refreshes, which Zoho rations.
9. **A re-sent webhook duplicates.** `/events` answers Twilio before it does the Zoho work (`src/routes/events.js:36-44`), which avoids retries from slow Zoho calls. There is still no idempotency on the insert. Likelihood low: UNVERIFIED.
10. **Client site: fixed costs that do not scale with use.** The every-minute schedules keep the database awake, which was about 80% of the hosting credits when measured. The appointment-setting replies are written for the most expensive model tier. Both are choices, not bugs.
11. **Client site: every tracked call is summarized.** The call sync reads a Voice Insights summary for each call, and that is billed per minute of the call. It is a quiet surcharge on all lead-line minutes.
12. **Long automated texts.** Twilio bills per 153-character segment and adds a carrier fee to each. A text with a greeting, a question and a signature is two or three segments, so it costs two or three times a short one.

## What this means for pricing

- The dialer's cost is three meters per outbound minute (PSTN, browser leg, recording) plus a storage tail. The model prices all three and carries the storage tail by tenant age.
- Until item 1 is closed, included minutes are a promise Kore cannot bound. The dialer add-on should not be sold on a Kore-paid Twilio account before the token route is authenticated.
- Zoho API credits are not a dollar cost. They are a ceiling: a busy seat logging every dial attempt twice draws the allowance four times per call.
- No tool in use has a fixed monthly cost per tenant for AI texting. With SendBlue gone, AI SMS costs what its texts and its model calls cost, so its price is a question of value, not of a cost floor.
- The lead lines the client site runs on Twilio (calls, Voice Insights, voice prompts, numbers) are a platform cost the model has no figure for yet.
