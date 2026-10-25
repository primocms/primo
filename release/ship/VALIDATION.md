# RC.12 validation status

Prepared for review, not GO for publication/deployment. RC.12 changes product bytes; RC.11 results are historical. Link final-head CI and hosted/registry gates before shipping.

Historical baseline: RC.11 product 5642f312bd29b83dea7ed3c86c68581ad52c5db3 and QA 91ff71f82a7c276b609a6d861e22c48ef536c7d4 report five native targets, 47/47 per desktop engine, native Safari, installed CLI/MCP handoffs, recovery/framing and Firefox stress in #1351–1353. None qualifies RC.12.

Current consolidation checks pending: source/type/Svelte, integration regressions, Go suite, browser/publication/repeater tests, dependency audit and exact native packages. Results will be updated after execution.

External gates intentionally pending: MCP-first registry publication/final stable locks, RC.12 hosted purchaser/ingress/realtime/mail qualification, selected host/support/recipients, first-client devices/domain/operations and actual legacy-migration checks. Publication-dependent gates cannot pass without publication authorization.
