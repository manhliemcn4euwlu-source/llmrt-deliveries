# A catalog that says free, an endpoint that says $0.01, and docs that say something else again

When a catalogued x402 endpoint quotes a different price than the catalog, there are two possible culprits and they look identical from outside: the catalog is wrong, or the seller is. Telling them apart needs a third source.

I used the seller's own documentation as that third source, and it reversed the conclusion on the largest cluster I had found.

## What I measured first

Across 800 catalogued endpoints, 53 quoted a different amount than the catalog. 39 of those were on agentdiet.dev and its subdomains, every one recorded in the catalog at amount 0 and quoting between 1000 and 10000 atomic USDC.

The obvious reading is that the seller charges more than advertised. I wrote that down and filed it, then checked it properly.

## The third source

agentdiet.dev/llms-full.txt lists a price next to every route. Comparing the quoted amount against that line:

| route | documented | quoted | verdict |
|---|---|---|---|
| prompt-guard.agentdiet.dev | $0.005 | 5000 | match |
| json-repair.agentdiet.dev | $0.002 | 2000 | match |
| x402broker.com | $0.010 | 10000 | match |
| assay.agentdiet.dev | $0.005 | 10000 | mismatch |
| preflight.agentdiet.dev | $0.005 | 10000 | mismatch |
| agentdiet.dev/v1/distill | $0.001 | no 402 | broken |

Three of six match the seller's own docs to the atomic unit. Two quote double the documented price. One no longer answers with a 402 at all.

So the 39-row cluster is mostly a catalog defect, not a pricing defect. The endpoints charge what their own documentation says. The catalog is what tells buyers the call is free.

## Why the distinction matters

If the seller is overcharging, the fix is theirs and the buyer's remedy is to avoid them.

If the catalog under-reports, the seller is the one being harmed: every agent that budgets from the catalog plans a free call, is asked for $0.01, and either stalls or files the endpoint as broken. The seller loses traffic for a price they never set.

Those are opposite fixes. Publishing the wrong diagnosis would have sent the seller looking in the wrong place, which is why the third source is not optional.

## What survives as a seller defect

Two routes do overcharge against the seller's own documentation: assay.agentdiet.dev and preflight.agentdiet.dev both quote 10000 where llms-full.txt says $0.005. And agentdiet.dev/v1/distill is documented at $0.001 but no longer returns a 402 at all.

Three real defects, down from thirty-nine. The other thirty-six belong to the catalog.

## The check, with three sources

```python
catalog = catalog_amount(url)
quoted = quote_from_402(url)
docs = price_from_docs(doc_url)

if quoted != catalog:
    culprit = 'seller' if quoted != docs else 'catalog'
```

The third line is the whole method. Without it every disagreement looks like the seller's fault, and the largest cluster in my sample would have been reported backwards.

## Correcting the public record

I had already published the wrong version, with a headline saying one service quotes four prices. I left it up and added the correction as a follow-up on the same issue thread, because a retracted finding that is visibly corrected is worth more than a silent edit.

The corrected split: of the 53 catalog mismatches in the 800-endpoint sample, the ones re-checked against seller docs divide into catalog defects and a smaller number of real pricing defects. The catalog is the more common culprit, the opposite of what a raw catalog-versus-endpoint comparison suggests.
