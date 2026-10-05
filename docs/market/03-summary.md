# HaulOS pricing: summary

**This model runs on assumptions, not usage.** The usage pull returned nothing, so every usage figure is assumed. Vendor prices are real (read 2026-10-04). Margins are tool cost only: no support, sales or payment fees.

## Recommended tiers (4 seats)

| Tier | In it | Price a month | Margin, price only | Margin with overage |
| --- | --- | --- | --- | --- |
| Core | Platform | $349 | 75% | 75% |
| Growth | Core, dialer ($79 a seat, 1,200 minutes), SMS ($49, 1,000 segments) | $714 | 51% | 66% |
| Complete | Growth, compliance ($79), AI SMS ($249) | $1,042 | 56% | 66% |

Overage at 2.5 times cost: $0.059 a minute, $0.032 a segment. SMS setup $399 once.

Blended: $824 a tenant a month ($644 with no overage), 68% margin. At month 24, 2%, 5% and 10% of 901 household-goods brokers is 18, 45 and 90 tenants: ARR $178k, $445k and $889k. With carriers (4,664 firms) the base case is $2.3M.

Changes to the starting prices:

- **Charge overage.** Without it the dialer makes 38% and SMS loses money.
- **Add a 5,000-segment SMS pack at $149** (55%).
- **Test AI SMS at $299** (64%). At $249 it makes 57%.
- **Keep the dialer at $79** if recordings expire at 90 days and ring time stops billing (69% at 1,200 minutes). Otherwise $99.

## Margin by add-on, per tenant that takes it

| Add-on | Cost to serve | Margin with overage | Margin, price only |
| --- | --- | --- | --- |
| Platform | $88 | 75% | 75% |
| Dialer, 4 seats | $196 | 61% | 38% |
| SMS | $67 | 62% | -37% |
| Compliance | $1 | 99% | 99% |
| AI SMS | $108 | 57% | 57% |

## Top 3 risks

1. **Usage is unmeasured.** At 26 dial attempts a day a seat fits in 1,200 minutes. At 120 the flat price loses 14%.
2. **Zoho Voice lists at $34 a user with unlimited calling.** The dialer costs a tenant $45 more a seat and is metered.
3. **Uncapped cost in the code.** The token route is open to anyone with the URL, and recordings are never deleted.

## What would change my mind

- A Twilio bill showing the leg mix. Cost per minute is assumed at $0.0236.
- A Zoho reseller margin of 15% or more: about $43 a tenant at 20%, at no cost.
- Tenant sites sharing a database: platform margin goes from 75% to 86%.
- A confirmed carrier count: 5 to 10 times the broker-only market.

## Inputs to verify

1. Dial attempts per seat per day, and the share answered.
2. The Twilio bill by category, and whether ring time is billed.
3. SMS segments per tenant per month.
4. Seats per tenant: the model uses 4, the first client has 2.
5. Whose Twilio account carries a client's usage.
6. Netlify credits per tenant site; Forge plan; EC2 instance type.
7. Zoho edition, reseller margin, and an auto dialer price (none is published).
8. SendBlue lines and outbound price; AI tokens per conversation.
9. What the FMCSA household-goods flag means, and the carrier count.
10. Attach rates and the month-24 share: all starting hypotheses.
