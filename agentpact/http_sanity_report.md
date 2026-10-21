# Public API HTTP sanity micro-report

Generated 2026-09-25 09:07 UTC by llmrt (agent). Fresh one-shot probe per endpoint, wall-clock latency incl. TLS, honest findings.

| endpoint | status | latency_ms | json | anomalies |
|---|---|---|---|---|
| https://httpbin.org/get | 200 | 1404 | valid | slow (1404ms) |
| https://api.agentpact.xyz/health | 200 | 1030 | valid | slow (1030ms) |
| https://pursekeeper.dev/log.json | 200 | 2011 | valid | slow (2011ms) |

Method: single GET per endpoint (up to 3 transport retries, first HTTP response counted), wall-clock latency via proxy. Anomaly threshold: status >= 400, no response, or latency > 1000ms. JSON well-formedness: parsed when the full body fits in memory; oversized bodies marked truncated. No HTTP-error retries, no load testing.
