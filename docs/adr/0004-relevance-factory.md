# ADR 0004 — Relevance Factory orchestration

- **Status:** Proposed
- **Date:** 2026-10-25
- **Affects:** MCP/API access to calibration and auto-tuning, shared application commands,
  workflow state, observability and delegated control.
- **Builds on:** [ADR 0002](./0002-judge-calibration.md) for calibration,
  [ADR 0003](./0003-ai-judge-prompt-auto-tuning.md) for auto-tuning, and
  [PR #1847 — MCP server](https://github.com/o19s/quepid/pull/1847).
- **Delivery:** A separate follow-on project; the shared application boundary must be aligned
  with auto-tuning from the start.

---

## 1. Context and prerequisite

Here, **Relevance Factory** means an external system, including an AI agent, that coordinates
reference acquisition, calibration and auto-tuning, inspects their evidence and decides what to
do next. It must be able to drive the process without browser automation or direct database
writes. This ADR defines the external API and agent integration as a follow-on project to
[ADR 0003 — Auto-tuning AI judge prompts](./0003-ai-judge-prompt-auto-tuning.md).
The auto-tuning project must leave the shared application boundary defined below.

**First prerequisite: merge [PR #1847 — MCP server](https://github.com/o19s/quepid/pull/1847).**
Relevance Factory builds on its existing agent-access foundation, rather than introducing a
second MCP server. At inspected head `781771e4a262`, #1847 proposes an opt-in `/mcp` endpoint
(`MCP_SERVER=true`), personal-key authentication, user-scoped data collections and write tools.
It does not yet expose calibration/auto-tuning sessions or their lifecycle commands. Extend that
surface after it merges, checking the final shipped contract against its
[MCP documentation](https://github.com/o19s/quepid/blob/781771e4a262a8a30dc389538d1afed3b91700fa/docs/mcp_server.md).
This prerequisite is for Relevance Factory; #1827 remains the calibration prerequisite for
auto-tuning itself.

## 2. Build the shared boundary in auto-tuning

- **One command layer.** The Calibration UI, built-in Ruby tuner, optional GEPA worker and future
  external agent invoke the same application commands over the same sessions/runs. Controllers
  and tool wrappers translate requests; eligibility, budget, state and promotion rules stay in
  those shared commands. Calibration-only evaluation remains available without starting a tuner.
- **Addressable, durable state.** Persist stable ids for the session, reference dataset/split,
  candidate and calibration runs. Keep configuration and snapshots separate from mutable progress.
  Expose a state revision, current phase and allowed next actions with refusal reasons; consumers
  must not infer them from UI text, Turbo messages or queue internals. Preserve #1827's child-run
  statuses; the parent session tracks the broader workflow.
- **Retryable commands.** Record a caller's command identity and payload fingerprint so replaying
  an accepted create/start/evaluate/apply request returns its existing result rather than causing
  duplicate work. A reused identity with different input is a conflict. State-changing commands
  check an expected revision atomically. Persist accepted work before dispatch and recover
  unfinished dispatch after a restart. Provider timeouts can leave call completion or billing
  uncertain; command deduplication is not a promise of exactly-once provider execution.
- **Explicit control ownership.** A session uses either the built-in search loop or externally
  supplied candidates. Both use the same evaluator and policy. Only one controller advances
  candidate selection at a time; an external agent cannot race the built-in tuner or mutate
  frozen configuration mid-run.
- **Structured evidence.** Persist the outcomes, counters and provenance needed for the readable
  report and a machine-readable representation. A failed command/run has a stable reason code,
  explanatory message and retryability, not just an exception string. Record actor and correlation
  ids for commands and transitions so an agent's actions can be traced alongside manual actions.

## 3. Future external control surface

These are conceptual operations, not endpoints implemented by this ADR:

| Operation | Observable result and control boundary |
| --- | --- |
| Discover and plan | List accessible books/judges, supported reference target types (human or advanced LLM), eligible-label counts, capabilities and expected calls/cost where known. Validate configuration and an explicit budget before work starts; estimates may be unknown and must not masquerade as hard limits. |
| Create and start | Freeze the chosen reference/input manifest and target configuration, persist the session and return its id before long work begins. New reference-label acquisition is an explicit, budgeted phase. |
| Inspect and follow | Read session/candidate/run status, progress, results and allowed next commands; list sessions by book or caller correlation id to recover after a client disconnect. |
| Drive experiments | Start the built-in tuner, or submit candidate prompts and request train/validation evaluations in external-control mode. The server still enforces prompt length, split access, concurrency and budget. |
| Cancel and resume | Stop scheduling new work, report cancellation requested while an in-flight call settles, and account for its outcome. Resume unfinished work only with remaining budget and unchanged frozen inputs; it does not erase spent calls or failed attempts. |
| Finalise | Freeze one selected candidate and compare it with the baseline on the held-out test. The proposer cannot read test examples/labels or use final-test feedback to continue the same search. |
| Apply | Apply the eligible, tested candidate as a separate authorised command, tied to its report and expected saved-judge revision. Completing a run never applies it implicitly. |

A future authorised automation policy may delegate Apply to an external agent; a human click
need not be permanently mandatory. That is separate from permission to run experiments and must
be explicit about eligible results and the judge it may change. [ADR 0003 D2](./0003-ai-judge-prompt-auto-tuning.md#d2--add-a-bounded-ruby-tuner-above-calibration)'s intervening-edit check and
[D3](./0003-ai-judge-prompt-auto-tuning.md#d3--the-metric-is-agreement-with-the-chosen-reference-held-out-by-query)'s evaluation rules apply to both people and agents. After test results have informed another
experiment, that test manifest is reused evidence, not a fresh untouched holdout.

## 4. Observation and access

The machine-readable view should include phase/status/revision, timestamps and last progress,
completed/pending/invalid/failed counts, consumed and reserved calls, token/cost usage where
available, budget remaining, child run ids, reference type/identity, metric and dataset versions,
split-specific results and links
to the prompt/report artifacts. Preserve metric denominators, undefined figures and partial
coverage; an agent must distinguish a finished evaluation from a usable improvement. Reports
must say whether agreement is against humans or the selected advanced LLM reference.

Durable state reads and polling are sufficient for the first external API. A later event feed or
webhook delivery should carry session/revision/event ids so clients can deduplicate and catch up
after disconnects; it is a notification of persisted state, not its only record. Choose event
delivery, retention and ordering guarantees during this project rather than treating Turbo
broadcasts as an integration protocol.

Reuse #1847's MCP authentication, collection/tool scoping and credential-field exclusions, together
with Quepid's [personal access token authentication](../operating_documentation.md#using-personal-access-tokens)
and book/judge access rules. The current [API key model](../../app/models/api_key.rb) is attached
to a user and has no per-operation scope model; scoped service identities and delegated Apply
permissions are follow-on design work, not assumed capabilities. API responses and events must
omit provider credentials, enforce the session's held-out-data boundary and expose document
content only within the caller's access. Follow the existing [API routing](../../config/routes.rb)
and [HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions), with documented,
versioned JSON schemas. Add calibration/tuning collections and command tools to #1847's MCP
server; JSON API adapters and MCP tools invoke the same command layer and result projections.
Neither transport owns another state machine.

An ordinary book-owner token can also read original labels through existing REST endpoints or
#1847's [judgement collection](https://github.com/o19s/quepid/blob/781771e4a262a8a30dc389538d1afed3b91700fa/app/mcp/judgement_collection.rb).
A blind-search worker therefore needs restricted delegation or separately protected holdout
material across all those surfaces. Hiding test labels only in the new tuning response would
not enforce ADR 0003's held-out-data rule. Design that access boundary in this project before claiming agents
cannot inspect the held-out labels.

## 5. Delivery boundary and acceptance

**In the auto-tuning project:** establish and test the shared commands, durable session state,
revision/retry semantics and structured results above. Keep external transport choices out of
the core. This makes UI-led delivery compatible with later unattended operation.

**In the Relevance Factory project:** first merge #1847, then extend its MCP surface
with the workflow commands above and add JSON API access for other clients as needed. Specify
capability discovery, authentication/delegation and event transport if needed. Prove that a
cookie-free client can drive both reference target types from planning through
evaluation and authorised application, reconnect by id, repeat a command without duplicate work,
cancel/resume within budget and handle an intervening judge edit. Also verify that unauthorised
Apply and held-out-label access are rejected. The same tests must exercise the shared command
layer used by the Calibration UI; external orchestration must not fork the tuning semantics.
