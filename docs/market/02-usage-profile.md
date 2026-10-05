# Usage profile

Written 2026-10-04.

**There are no actuals.** The Step 0 pull returned nothing (see `inputs/pull-log.md`), so n = 0 months and 0 seats for every metric. Every per-seat and per-tenant figure below is an ASSUMPTION built from stated drivers. None of it is measured. Low and high are plus or minus 50% of base, the rule for fewer than three months of data.

The workbook reads `inputs/usage-actuals.json`. When that file has numbers, the `UsageActuals` sheet replaces each assumption with the measured mean on its own, and with P25 and P90 once a metric has three clean months.

## What would be excluded once data exists

| Traffic | Treatment | Why |
| --- | --- | --- |
| `kore` (dev) | Excluded | Test calls by developers |
| `kore-sandbox` | Excluded | Zoho sandbox, no customers |
| The Moving Group, 2026-07 to 2026-09 | Flag as ramp-up, include with a note | Went live in stages; 2 agents |
| 2026-10 | Excluded | Four days, not a full month |

## Dialer, per active seat per month

Drivers (all ASSUMPTION, all inputs on the `Assumptions` sheet):

| Driver | Base |
| --- | --- |
| Working days a month | 21 |
| Outbound dial attempts per seat per day | 60 |
| Attempts answered by a person | 20% |
| Attempts answered by voicemail | 35% |
| Attempts not answered | 45% |
| Billed minutes when a person answers | 4 |
| Billed minutes when voicemail answers | 1 |
| Browser-leg minutes billed on an unanswered attempt | 1 (UNVERIFIED: see audit item 6) |
| Inbound calls per seat per day | 8 |
| Inbound calls answered | 80% |
| Billed minutes per answered inbound call | 4 |
| Billed inbound minutes on an unanswered inbound call | 1 (UNVERIFIED: see audit item 7) |

What the drivers give:

| Metric | Low | Base | High | n | Basis |
| --- | --- | --- | --- | --- | --- |
| Calls (outbound attempts plus inbound) | 714 | 1,428 | 2,142 | 0 | ASSUMPTION |
| Connected calls (a person on the line) | 193 | 386 | 580 | 0 | ASSUMPTION |
| Billed minutes, PSTN outbound | 725 | 1,449 | 2,174 | 0 | ASSUMPTION |
| Billed minutes, PSTN inbound | 286 | 571 | 857 | 0 | ASSUMPTION |
| Billed minutes, browser leg | 1,277 | 2,554 | 3,830 | 0 | ASSUMPTION |
| Recorded minutes (outbound only, as coded) | 725 | 1,449 | 2,174 | 0 | ASSUMPTION |
| Minutes a customer would count (PSTN out plus in) | 1,010 | 2,020 | 3,030 | 0 | ASSUMPTION |
| Answering-machine-detection calls | 0 | 0 | 0 | 0 | Not used in the code today |

Mean and median are the same number here because there is one assumed profile, not a distribution.

Two things in this table matter for pricing:

- The browser leg runs longer than the phone leg. It is billed on unanswered attempts too, if the audit's reading is right. That makes it about a fifth of voice cost.
- At 60 attempts a day a seat uses about 2,020 customer minutes, well above the 1,200 in the starting hypothesis. The 1,200 allowance only holds margin if overage is charged, or if real usage is closer to 26 attempts a day.

## Texting, per tenant per month

| Driver (ASSUMPTION) | Base |
| --- | --- |
| Seats per tenant | 4 |
| New leads per seat per month | 100 |
| Automated texts per lead | 6 |
| Segments per automated text | 1.6 |
| Texts an agent types per day | 10 |
| Segments per typed text | 1.3 |
| Leads that reply | 25% |
| Inbound messages per replying lead | 2 |

| Metric | Low | Base | High | n | Basis |
| --- | --- | --- | --- | --- | --- |
| Outbound segments | 2,466 | 4,932 | 7,398 | 0 | ASSUMPTION |
| Inbound segments | 100 | 200 | 300 | 0 | ASSUMPTION |

A tenant that runs a six-step follow-up on 400 leads uses about five times the 1,000 segments in the starting SMS add-on.

## Zoho API credits per call

Counted from the code, not measured: one search and one insert when Twilio reports the call, and the same again when the widget reports it. That is 4 API calls per logged call if both paths fire, 2 if only one does. Zoho's published weights (read 2026-10-04) are 1 credit for a search and 1 credit for an insert of up to 10 records, so 4 credits a call. At the base profile, four seats make about 272 logged calls a day, so about 1,088 credits a day. An Enterprise org with four users is allowed 54,000 a day (50,000 plus 1,000 a user); the first client's allowance was 53,000 when last read (2026-10-01, prior observation). This is a ceiling to watch, not a cost.

## SendBlue contacts per day

ASSUMPTION: the leads that reply are the conversations the AI handles. 400 leads at 25% is 100 conversations a month, about 3.3 new inbound contacts a day on average. No maximum can be given without data. SendBlue publishes a limit of 1,000 inbound contacts per line per rolling 24 hours on the $100 plan (read 2026-10-04), so one line is far more than this profile needs: the cost is the flat fee, not the limit.

## AI usage per conversation

ASSUMPTION: 4 AI turns per conversation, about 3,500 input and 300 output tokens a turn. No token counts were pulled.

## Prior observations (not from this pull, not used as actuals)

- The first client has 2 Zoho Voice users on the Solo tier and 3 lines (2026-09-30). The model's 4 seats per tenant is the starting hypothesis, not this figure.
- The client site used about 9,000 Netlify credits a month, about $60 (2026-10-01).

## What to pull first

1. Twilio `Usage/Records/Monthly` for the HaulOS account: settles the leg mix and whether ring time is billed.
2. Zoho Voice call log for the first client: attempts per seat per day and the answer mix.
3. One month of segment counts from the client's texting: settles the 1,000-segment allowance.
