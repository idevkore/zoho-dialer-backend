# Usage pull log

Pulled 2026-10-04. Window asked for: 2026-07-01 to 2026-10-04 (July, August, September, and October to date).

**Result: no usage was retrieved.** `usage-actuals.json` is all nulls. Nothing in it is estimated. The pricing model therefore runs on labeled assumptions and published prices.

Rules followed: list/get/fetch only, nothing created, changed, sent or dialed; no `.env` or token file opened; aggregates only.

## What was reachable

| System | Status | What was tried (names only) | Outcome |
| --- | --- | --- | --- |
| Twilio, HaulOS account | UNAVAILABLE | Twilio CLI, two saved profiles: `Applications` list on each, to identify the account by its TwiML application webhook host. | Neither profile has an application pointing at the HaulOS dialer backend host, so neither is the HaulOS account. Nothing else was read from them. |
| Twilio, desktop connector | UNAVAILABLE | None. | Bound to another project's account. Its tools are Monitor alerts and events, single-message fetch, Lookups and consent lists. It has no Usage Records, Calls or Messages list, so it could not answer the pull even if it were the right account. |
| Twilio docs connector | n/a | None. | Documentation search only. |
| Zoho CRM, The Moving Group (prod) | NOT PULLED | Planned: `org`, `users` (active), `Calls` record count by month. | The client website repo has read-only script tooling for this org. The session's permission check on production reads stopped the run before any request was sent. |
| Zoho Voice, The Moving Group (prod) | NOT PULLED | Planned: call log and SMS log, paged back to 2026-07-01, throttled under the 20 requests a minute limit. | Same block as above. |
| Twilio, The Moving Group's own account | NOT PULLED | Planned: `Usage/Records/Monthly`, 10DLC brand and campaign status. | Same block. Also outside the written scope ("only the HaulOS Twilio account"), so it should stay a separately labeled block if it is ever pulled. |
| Client website database (prod) | NOT PULLED | Planned: monthly counts of leads, tracked calls, campaign sends, opt-outs. | Same block. |
| Zoho CRM, Kore org and sandbox | UNAVAILABLE | None. | The HaulOS Zoho configuration tool only holds settings-scope tokens and provisioning commands that write. It has no read path for org, users or records. Not run. |
| SendBlue | UNAVAILABLE | None. | No connector or CLI. No SendBlue code in any HaulOS repository. |
| Zoho Marketing Automation | UNAVAILABLE | None. | Not in use. No tool. |
| Laravel Forge | UNAVAILABLE | Forge CLI `server:list`. | The CLI is installed but not signed in ("resource could not be found"). Plan and server size not retrieved. |
| AWS | UNAVAILABLE | None. | No AWS CLI. The EC2 instance type of `dk-services` is not known. |
| Azure | NOT QUERIED | None. | The Azure stack is planned, not deployed. There is nothing to measure. |
| GitHub | REACHED | `gh api orgs/idevkore` (plan fields only). | Plan: Free. 1 seat filled. 11 private repositories. |
| Netlify | NOT QUERIED | None. | Measured in an earlier study on 2026-10-01. Carried as a prior observation, not re-read. |
| FMCSA public dataset `6eyk-hxee` | REACHED | Socrata count queries on `broker_stat`, `common_stat`, `contract_stat`, `hhg_chk`. Dataset rows last updated 2026-10-04 13:55 UTC. | See "Market counts" below. |
| Client request board | REACHED | Open-card list and five cards read, for what is planned. | Used in the audit and the summary. No card added or changed. |

Connected but not used, because they were outside the pull scope: Sentry, Microsoft 365. Vendor invoices in mail would answer the Forge plan, the EC2 instance, the Zoho subscription and the SendBlue plan. Mail was not searched.

## Market counts (public, read 2026-10-04)

| Query on `6eyk-hxee` ("Carrier - All With History") | Count |
| --- | --- |
| Active broker authority and household goods (`broker_stat='A' AND hhg_chk='Y'`) | 901 |
| ...of which hold no active carrier authority (broker only) | 664 |
| ...of which also hold active carrier authority | 237 |
| Active common or contract carrier authority and household goods | 8,596 |
| Any active authority (broker or carrier) and household goods | 9,260 |

The 901 matches the 900 given as the base. The carrier count is more than double the "roughly 4,000" given. `hhg_chk` marks an authority that covers household goods; it does not show that the firm moves households today. Treat 8,596 as an upper bound and 4,000 as the working figure until the flag is confirmed.

## Prior observations carried into the model

These were measured in earlier work on the client website, not in this pull. They are used as Medium-confidence inputs and are listed in `usage-actuals.json` under `notes`.

- The Moving Group's Zoho Voice: 2 users, 3 lines, Solo tier (2026-09-30 probe; request-board card 63).
- The Moving Group's Zoho CRM API allowance: 53,000 credits a day (2026-10-01).
- Zoho Voice documents 20 requests a minute for texting (2026-10-01; scope of the limit unconfirmed, card 177).
- Netlify: credit-based Pro, about 9,000 credits a month, about $60, shared by five sites (2026-10-01).
- SendBlue was canceled for The Moving Group on 2026-08-27 because the recipient must message first (card 48).

## Data gaps

1. No Twilio usage or billing for any tenant. Minutes per seat, leg mix, recorded minutes, SMS segments, carrier fees and 10DLC fees are all assumptions.
2. No call counts or durations from Zoho Voice or the Zoho Calls module.
3. No Zoho API credit consumption. Credits per call are counted from the code, not measured.
4. No SendBlue account data. Plan, line count and limits come from public pages.
5. No Forge plan, EC2 instance type or AWS bill.
6. No AI usage (tokens per conversation) for AI SMS.

## How representative the data would be

The first client is still deploying. When the pull is re-run:

- `kore` (dev) and `kore-sandbox` traffic is test calling. Exclude it from per-seat averages.
- The Moving Group has 2 agents and went live in stages (automated texts on 2026-09-30, call recording on 2026-10-02). July to September is ramp-up. One client and two seats is not a distribution: low and high cases stay at plus or minus 50% of base until there are three clean months.
- The Moving Group's voice today is Zoho Voice plus inbound lead lines on its own Twilio account. Neither is the HaulOS Twilio dialer, so neither gives the browser-leg or recording mix the dialer will have.

## To fill the file

1. Sign a tool in to the HaulOS Twilio account (a named CLI profile is enough) and re-run: `Usage/Records/Monthly` gives every billed category in one call.
2. Allow the production read for The Moving Group's Zoho CRM and Zoho Voice, or export the two logs by hand.
3. Read the Forge plan and the EC2 instance type from the two consoles.
