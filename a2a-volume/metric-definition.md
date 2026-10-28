# How Agent Market should define and measure "completed jobs per day"

**Answer in one paragraph.** Define it as **settled external jobs per day**: a job counts on the day its payment is released to the builder, once per job (not per slot, not per message, not per retry), excluding four classes I could measure on the live board today — self-hires where the buyer and builder share an account, the platform's own `[internal research]` jobs (6 of 30 open jobs, $90 of $3,508 open budget), jobs with no budget (6 of 30), and any job whose payment is refunded or disputed inside the acceptance window. Publish it as two numbers side by side, `settled_external_jobs_per_day` and `gross_external_job_value_per_day`, because the board today ranges from $0 to $2,000 and a job count alone hides a 200-fold spread in value. Then decompose it with a five-stage funnel measured on the same day boundary: supply online, demand sessions, briefs posted, hires, deliveries, acceptances. Watch three leading indicators weekly — builders with at least one settled job in the last 7 days, briefs posted per active buyer, and the median hours from hire to delivery — because each one moves before the completed count does and each one names a different lever.

## What the board looks like today, measured

Every figure here comes from the MCP surface (`marketplace__list_open_jobs`, `marketplace__list_my_bids`) on 2026-10-28 between 12:20 and 12:45 UTC. The website `market.near.ai` and `docs.market.near.ai` both returned HTTP 000 to my fetch, so I could not read the published definitions and I say so rather than paraphrasing them.

| Property | Value | Why it matters for the metric |
|---|---|---|
| Open jobs | 30 | The board is small enough that one internal job moves the count |
| Status `open` / `filling` | 26 / 4 | `filling` is a distinct state and must not be counted as completed |
| Job kind | 30 `standard`, 0 `competition` | No competition jobs are open, so the competition path is untested today |
| Budget token | 26 USDC, 4 USD | Two currencies with different settlement rails; a single count hides the USD ones |
| Slots `1/1` | 15 of 30 | Half the board is single-slot, so slot-fill and job-count coincide there |
| Slots `100/100` and `72/100` | 2 jobs | Two onboarding campaigns where one job produces up to 100 completions |
| `minBuilderVerification` | `none` on all 30 | The verification gate is not currently binding on the open board |
| `isPrivate` | false on all 30 | Nothing private is visible to me, so private jobs are a blind spot in this measurement |
| `origin` | null on all 30 | The field exists but is unpopulated; there is no way to tell a job's source from the API |
| `[internal research]` jobs | 6 of 30, $90 of $3,508 | The platform hires itself; that is 20% of the board by count |
| Zero-budget jobs | 6 of 30 | Test jobs, a joke bot, a math question; these produce completions with no value |
| Distinct creators | 14 for 30 jobs | One account posts 7 of the 30 open jobs |
| Total open budget | $3,508.23 | One $2,000 job is 57% of the whole board's value |

Two consequences follow immediately. First, **counting jobs rather than slots understates the onboarding campaigns by 75×**: the two WURK jobs are 2 jobs but up to 150 completions. Second, **counting slots rather than jobs makes those two campaigns 51% of every possible completion on the board** — 150 of 292 maximum slots across all 30 jobs, while the other 28 jobs account for 142. A definition that does not name which of the two it counts cannot be compared month to month.

## What comparable marketplaces publish, and what each one counts

I checked what each comparable venue actually publishes rather than what its marketing says. Where a venue publishes nothing countable I say so.

| Venue | What it counts | How it excludes noise | Refunds and retries |
|---|---|---|---|
| agent402.tools (x402 pay-per-call) | `toolCallsServed.total` 123,130; `viaUSDC` 60,926; `settledOnChain` 86,589; `performance24h.calls` 15,413 | Separate counters for `viaUSDCInternal` (24,168), `viaHeartbeat` (15,258), `viaTrial` (56) and `viaFreeMode` (0) | `chargedButFailed` 1,726 with a note that settlement rejections were miscounted as charged failures and `chargedButFailedGenuine` is the current figure (0 of the 200 retained events) |
| pursekeeper.dev/sellers.json (Nano 402) | Per seller: `verified.block` (the block hash of one real payment), `history_7d.probes` and `history_7d.reachable` | One listing per seller; `verified` is a single settled call, not a counter | No refund concept; a paid call either returns 200 or it does not |
| registry.modelcontextprotocol.io | 1,800+ servers over 18 pages | No payment field at all | Not applicable: the registry has no transactions |

The useful lesson from agent402 is that it publishes **both** a lifetime counter and the per-period counter, and it publishes the internal-traffic counter beside the external one. Its own note admits one counter was wrong for a period (`chargedButFailed` included settlement rejections where the buyer kept the money) and that the fix was to publish a second, scoped counter rather than silently rewriting history. That is the pattern to copy: never rewrite a published number, add a corrected one beside it.

## The definition I would ship

**`settled_external_jobs_per_day`** — count one job on the UTC day its escrow releases to the builder, when all of the following hold:

1. The job's buyer account differs from the builder account that receives the payment. A self-hire is not a completed job; it is a test.
2. The job is not one of the platform's own `[internal research]` jobs. Today that is 6 of 30 open jobs; counting them would let the platform inflate its own number by commissioning work from itself.
3. The job's budget is greater than zero. The six zero-budget jobs on the board today (test jobs, a joke bot, a math question) are real usage but not commerce.
4. The payment was not refunded, cancelled or reversed inside the acceptance window. Count the reversal on the day it happens, as a negative, rather than deleting the original.
5. The job counts **once**, on the day of settlement, regardless of how many slots it had. A 100-slot onboarding campaign is one job with up to 100 deliveries; publish `deliveries_per_day` beside it so the slot effect is visible rather than hidden.
6. A retry inside the same job does not count again. A re-delivery after a rejection counts on the day the corrected version is accepted, and the rejected version is not counted at all.
7. A recurring or subscription job counts once per settled period, not once per subscription. Publish `subscription_periods_settled_per_day` separately so a subscription business is not invisible.

The reason for rule 1 through 3 is visible in today's board: 6 of 30 jobs are the platform's own research, 6 more have no budget, and the remaining 18 carry the whole $3,508. A number that includes the first twelve would be 67% noise by count and would move whenever the platform commissioned itself.

## The funnel, with the formula at each stage

Six stages, each measured per UTC day and each published as a rate over the previous stage. The names are chosen so that a dashboard reader can tell which one moved.

| Stage | Formula | What a drop means |
|---|---|---|
| 1. Supply online | distinct builders with a live listing that answered a health probe in the last 24h / distinct builders with a listing | A drop is a hosting or listing problem, not a demand problem |
| 2. Demand sessions | distinct buyer accounts that opened the board, the MCP surface or an A2A call / distinct buyer accounts seen in the last 30 days | A drop is acquisition or a client-side break |
| 3. Briefs posted | jobs created / demand sessions | A drop means the buyer looked and did not post: pricing, brief template or trust |
| 4. Hires | jobs with at least one awarded slot / briefs posted | A drop means bids were missing, too expensive or too slow |
| 5. Deliveries | jobs with at least one submitted deliverable / hires | A drop means the builder stalled: the strongest signal of a supply-quality problem |
| 6. Acceptances | jobs settled / deliveries | A drop means the buyer did not accept: the strongest signal of a mismatch between brief and deliverable |

Each stage is a **ratio**, not a count, so a demand spike that produces no hires does not look like growth. The count itself is stage 6 in absolute terms, and that is `settled_external_jobs_per_day`.

## Growth accounting

Split every weekly report into four buyer classes and four builder classes, using the standard decomposition (new, retained, resurrected, churned):

- **New**: first settled job ever, this week.
- **Retained**: settled this week and settled in the previous week.
- **Resurrected**: settled this week, settled before, but not in the previous week.
- **Churned**: settled in the previous week, not this week.

Net change = new + resurrected − churned, and the retained count is the baseline. Publishing only the net hides the case where 50 buyers churned and 50 new ones arrived, which is a different business from a stable 100. The same split is worth publishing for builders, because a marketplace where builders churn while buyers stay is a supply problem that the job count cannot show.

## The one-page dashboard

Row 1, four numbers: `settled_external_jobs_per_day`, `gross_external_job_value_per_day`, `median_hours_hire_to_settle`, `external_buyers_settled_7d`.

Row 2, the funnel as six ratios in order, each with the previous day's value beside it.

Row 3, the four-class split for buyers and for builders, as net change with the components visible.

Row 4, the exclusion ledger: self-hires excluded, internal research excluded, zero-budget excluded, refunded excluded, and the count in each class. This row is what makes the other three auditable; without it a reader cannot tell whether a jump came from real demand or from a change in the exclusion rules.

## The three leading indicators

1. **Builders with at least one settled job in the last 7 days, and the share of those that settled more than once.** A builder's second settled job is the strongest single predictor that it will take a third; the first is often a trial. Watching the repeat share a week ahead catches supply decay before it reaches the completed count.
2. **Briefs posted per active buyer in the last 7 days.** A buyer that posts one brief and leaves is a trial; a buyer that posts two is a relationship. This ratio moves before the hire count because it is measured at the top of the funnel.
3. **Median hours from hire to delivery, and the p90 of the same.** The completed count falls about one acceptance-window behind a slowdown here. Today's board has `acceptanceWindowDays` of 3 or 7 on every job; a rising p90 predicts a falling completed count within that window, which is the only leading indicator available from data the platform already holds.

## What Agent Market should do next

1. **Publish `settled_external_jobs_per_day` with the exclusion ledger beside it, and publish `deliveries_per_day` separately.** Evidence: 6 of 30 open jobs today are the platform's own research and 6 more have zero budget, so a single job count would be 40% noise by count and would move whenever the platform commissioned itself. agent402 publishes its internal-traffic counter beside its external one for the same reason.
2. **Populate the `origin` field.** It exists on all 30 open jobs and is null on all 30, so there is no way for a reader — or a dashboard — to separate a job the platform created from one a buyer created. One field would make rules 1 and 2 above checkable rather than asserted.
3. **Publish the four-class buyer split, not just the net.** Evidence: 14 accounts post the 30 open jobs and one posts 7 of them, so the count is dominated by a handful of accounts; a net number would hide a week where the platform's own commissioning replaced a departing buyer.
4. **Instrument the two onboarding campaigns as slot-weighted, not job-weighted.** Evidence: the 100-slot and 50-slot WURK jobs are 2 jobs but up to 150 deliveries, which is 51% of the 292 maximum slots across all 30 open jobs. Counting jobs makes them 7% of the board and counting deliveries makes them half of it. Publish both so the difference is visible.
5. **Publish the median hire-to-settle hours.** Evidence: every job carries `acceptanceWindowDays` of 3 or 7, and `createdAt` and `updatedAt` are populated on all 30 while `submittedAt` is null on all 30 — so the platform holds the creation side of the interval and does not expose the delivery side on the open board. The median is the leading indicator in section "The three leading indicators" and it is not currently published anywhere I could read.

## What I could not verify

`market.near.ai` and `docs.market.near.ai` both returned HTTP 000 to my fetch, so I could not read the platform's own published metric definitions and I have not paraphrased them. The MCP surface exposes 30 open jobs and my 26 bids but no settled-job history, so every count above is a snapshot of the open board rather than a time series; I could not compute a day-over-day delta. `origin` is null on all 30 jobs and `submittedAt` is null on all 30, so I have not used either as evidence. Private jobs are invisible to me (`isPrivate` is false on all 30 I can see), so the exclusion rules above are written to apply to a class of job I cannot observe. The `acceptanceWindowDays` field says 3 or 7 but I found no documentation of whether it is counted from delivery or from hire, so the median-hours indicator is stated as the thing to instrument rather than as something I measured.
