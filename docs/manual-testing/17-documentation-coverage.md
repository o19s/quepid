# Part 17: Documentation Coverage Audit

## Purpose

This part reviews the published [Quepid User Manual](https://quepid-docs.dev.o19s.com/2/quepid) in the order in which its pages appear, and records where the application manual suite provides coverage. The audit distinguishes interactive product behavior from deployment/configuration instructions: the latter need deployment smoke tests or automated tests, not a browser scenario in this guide.

It also reviews the 17 pages listed in the [Quepid GitHub wiki](https://github.com/o19s/quepid/wiki), in wiki navigation order. Wiki pages that only link to projects, blogs, videos, or community resources are recorded as reference-only rather than turned into artificial app tests.

## Ordered audit

| User Manual page | Coverage | Manual-test location or disposition |
|---|---|---|
| How to Use the Docs | Reference only | No app behavior. |
| What is Quepid? | Reference only | No app behavior. |
| Tutorials / Structure of Tutorials | Navigation/reference | Tutorial workflows are covered below. |
| Setting Up Your First Case | Covered | 3.2, 7.2, 7.7–7.10. |
| Tuning Relevance | Covered | 4.6–4.14, 6.7–6.9, 8.8. |
| Relevancy is a Team Sport | Covered | 9.1–9.5, 10.1–10.8, 11.1–11.9. |
| Quepid for Human Raters | Covered | 11.1–11.8. |
| How to Deploy Quepid Locally | Deployment-only | Verify with Docker/deployment smoke tests; not a browser regression scenario. |
| How to Deploy Quepid on Digital Ocean | Deployment-only / page says it needs updating | No reliable product scenario can be derived until the page is corrected. |
| Configure Quepid for SSL and HTTPS | Deployment-only | Verify per-environment with an HTTPS deployment smoke test. |
| Configure Login Options | Deployment/configuration | 1.2–1.3 cover the resulting login behavior; environment-variable wiring is deployment coverage. |
| Configure Sign Up Options | Deployment/configuration | 1.1 covers enabled/disabled UI behavior. |
| Add a Recency Scorer | Covered | 8.3–8.4 cover custom scorer creation/editing; use the documented recency code as the fixture. |
| Create a Personal Access Token | Covered, strengthened below | 1.8 now explicitly exercises a real authenticated request and token revocation. |
| Include Images | Strengthened below | 17.1 adds an explicit thumbnail/full-image field-spec check. |
| Run a Case Nightly | Strengthened below | 17.2 adds background execution, nightly toggle persistence, and completion checks. |
| Manage API and Proxy Limits | Strengthened below | 17.3 adds requests-per-minute configuration and observable throttling. |
| Connect Quepid to Elastic Cloud | External integration | 7.2 covers endpoint configuration; a real Elastic Cloud account is required for a full provider smoke test. |
| Use Quepid's API | Strengthened below | 17.4 executes a documented read-only API request with a bearer token. |
| Post Announcements to Users | Covered | 14.9. |
| Integrate External Eval Pipeline | Strengthened below | 17.5 posts an externally calculated score and verifies it in the case history. |
| Troubleshoot Your Deployment | Deployment-only | Verify environment-specific error pages/logging; do not enable verbose errors on a shared environment. |
| Use Ollama as LLM | Strengthened below | 17.6 covers configuring an Ollama AI Judge and running one bounded job. |
| Reference / Core Concepts | Reference only | Concepts are exercised by the feature scenarios; no separate UI behavior. |
| Quepid App Settings | Deployment/configuration | Verify with environment-specific configuration smoke tests. |
| Quick Start Wizard | Covered | 3.2 and 7.7–7.10. |
| Case Screen | Covered | 4.17–4.24. |
| Manage Your Queries | Covered | 4.2–4.7, 4.15–4.23. |
| Relevance Panel | Covered | 4.10–4.14 and 4.24. |
| Importing and Exporting Ratings | Covered | 6.1–6.2 and 10.7–10.9. |
| Managing Snapshots | Covered | 5.1–5.5. |
| Managing Cases | Covered | 3.1, 3.5–3.6, 6.3–6.5, 6.10. |
| Importing and Exporting Cases | Covered | 3.3–3.4 and 6.1–6.3. |
| Manage Your Team | Covered | 9.1–9.6. |
| Managing Scorers | Covered | 8.1–8.8. |
| Custom Scorers | Covered | 8.3–8.7. |
| API Documentation | Covered | 15.3 and 17.4. |
| Quepid Administration CLI / Thor | Operational-only | Verify CLI tasks in a deployment/CLI test pass; no browser scenario. |
| Explanation | Covered | 6.7–6.8 and 4.23. |
| How Many Queries and Documents Do I need? | Covered | 6.9 and 11.7. |
| Using Notebooks for Analytics | Covered | 15.6. |
| Thinking about Team and Sub Teams | Covered | 9.1–9.6. |
| Integrate Quepid Into Your Eval Workflow | Covered by combination | 6.1–6.2, 10.7–10.9, 17.4–17.5. |

## GitHub wiki audit

| Wiki page | Coverage | Manual-test location or disposition |
|---|---|---|
| Home | Reference/navigation | Links and entry points are covered by 15.3; the wiki page itself is external content. |
| Blog Posts About Quepid | Reference-only | External reading list; no app behavior. |
| Community | Reference-only | External support/community links; no app behavior. |
| Extending Quepid for Your Search Engine | Developer reference | 7.2 and 7.7–7.10 exercise the Search API/mapper extension seam; implementing a native Splainer engine requires code and integration tests. |
| How Scoring Works in Quepid | Strengthened below | 8.8 covers the scorer catalog; 17.7 checks the documented metric semantics and single-scorer behavior. |
| How to release Quepid | Release/operations-only | Validate through CI and release smoke tests, not browser manual testing. |
| Installation Guide | Deployment-only | No browser scenario; verify with an environment-specific deployment smoke test. |
| Judgement Rating Best Practices | Strengthened below | 11.1–11.8 cover judging mechanics; 17.8 checks rating-scale and information-need consistency. |
| Related Projects | Reference-only | External project links; no app behavior. |
| Tips for working with Quepid | Educational/reference | The underlying workflows are covered across Parts 4–12; no separate feature is described. |
| Troubleshooting Elastic Cloud and Quepid | Provider troubleshooting | 7.2 and 17.9 cover the connection smoke path; provider-account diagnosis is environment-specific. |
| Troubleshooting Elasticsearch and Quepid | Provider troubleshooting | 7.2 and 17.9. |
| Troubleshooting Opensearch and Quepid | Provider troubleshooting | 7.2 and 17.9. |
| Troubleshooting SearchAPI and Quepid | Placeholder/reference | 7.7–7.11 cover the actual Search API and proxy behavior; the wiki page contains no additional testable workflow. |
| Troubleshooting Solr and Quepid | Provider troubleshooting | 7.2 and 17.9. |
| Vectara and Quepid | Provider integration reference | 7.2 and 17.9 cover endpoint creation and a query smoke test when credentials are available. |
| Videos on Learning to use Quepid | Reference-only | Video links are not product behavior; the corresponding workflows are covered in Parts 3–12. |

## Repository `docs/` audit

The following covers every non-manual-testing file currently under `docs/`. The `docs/manual-testing/` files are the test suite being extended here; `tracking.yml` is its execution ledger.

| File or file group | Coverage/disposition | Manual-test location or follow-up |
|---|---|---|
| `docs/README.md` | Documentation index | Reference-only; links should be checked when docs are reorganized. |
| `docs/ENCRYPTION_SETUP.md` | Deployment/configuration | 17.10 verifies encrypted secrets are usable without being exposed; key provisioning remains an environment prerequisite. |
| `docs/operating_documentation.md` | Deployment/configuration | 17.10 covers the user-visible seams; provider, proxy, OAuth, health, notebooks, tokens, announcements, and external eval also map to 1.3, 1.8, 1.10–1.11, 14.9, 15.6, and 17.4–17.6. |
| `docs/database.md` | Operations-only | Backup/restore and database lifecycle require an infrastructure runbook, not browser testing. |
| `docs/running_with_postgresql.md` | Operations/compatibility-only | Requires a separate PostgreSQL deployment pass; the supported primary path remains MySQL. |
| `docs/docker_images.md` | Build/release-only | Verify image build and startup in CI/release smoke tests. |
| `docs/endpoints_solr.md` | Integration reference | 7.2, 7.7, 6.7–6.8, and 17.9. |
| `docs/endpoints_opensearch.md` | Integration reference | 7.2, 7.7, 6.7–6.8, and 17.9. |
| `docs/jupyterlite.md` | Integration/setup reference | 15.6; deployment-baked assets remain an environment-specific check. |
| `docs/data_mapping.md` | Data-model reference | Behavior is covered by Parts 3–14; no separate browser scenario. |
| `docs/app_structure.md` | Architecture reference | No app behavior. |
| `docs/complete_application_specification.md` | Rewrite/schema/business-rule reference | Mapped to Parts 1–16 and the User Manual audit above; no duplicate scenarios. |
| `docs/admin_scorer_editing.md` | Feature/reference | 8.4, 8.6, and 14.1–14.2. |
| `docs/admin_communal_scorers_removal.md` | Migration note | 8.8 and 14.1–14.2; migration history itself is not a runtime test. |
| `docs/examples/external_eval/README.md` | Integration example | 17.5. |
| `docs/examples/external_eval/store_score_for_case.py` | Integration example code | 17.5; validate with a disposable API token/case. |
| `docs/credits.md` | Attribution/reference-only | No app behavior. |
| `docs/agentic_javascript_extraction.md` | Engineering workflow reference | No product behavior; automated test process is outside manual coverage. |
| `docs/js_tooling.md` | Developer tooling reference | Validate with JS unit/lint checks, not browser manual testing. |
| `docs/test_suite_review_*.md` | Generated test review | Test inventory/reference; no additional runtime behavior. |
| `docs/todo/*.md` | Planning, implementation, and issue references | Test any item only when it becomes implemented user-facing behavior; do not treat todo prose as shipped behavior. |
| `docs/Quepid-Data-Storage-Briefing.pdf` | Architecture/reference artifact | No browser scenario; review when storage architecture changes. |
| `docs/erd.png`, `docs/image_*.png`, `docs/frog-pond.jpg`, `docs/rating-card-interface.png` | Diagrams/screenshots/reference media | Visual references only; corresponding UI is covered by Parts 4–6, 11, and 13. |

## Test scenarios

### 17.1 Image field specifications

- [ ] **Steps:** Use a disposable case whose search results contain an absolute image URL and a relative image path. In the case's displayed-field specification, configure one field as `thumb:` and one as `image:`; configure the relative field with the documented JSON `prefix`. Run the query and open the result.
- **Expected:** The thumbnail and full-size image render in the result card and the relative URL is prefixed correctly. Images are display-only, matching the Angular case UI; the document title opens document details. A missing/broken image does not break the rest of the result card.
- **Edge cases:**
  - [ ] Confirm an HTML/script payload in a result field is sanitized and cannot execute.
  - [ ] Confirm a result with only one configured image does not render duplicate image elements.

### 17.2 Background and nightly case evaluation

- [ ] **Steps:** Open Tune Relevance → Settings, enable **Evaluate Case Nightly**, save, and confirm the repeat/nightly indicator appears in the case header. Click **Rerun My Searches Now in the Background**, return to the dashboard, and wait for the run to complete.
- **Expected:** The case is queued without blocking the browser, progress/status is visible on the dashboard, the case's last-run metadata and scores update, and the nightly setting survives a reload. Disable it and confirm the indicator disappears.
- **Edge cases:**
  - [ ] Run a case with no queries and confirm the background job completes cleanly.
  - [ ] Confirm a second background request does not create duplicate concurrent work or corrupt the case state.

### 17.3 Search-endpoint request throttling

- [ ] **Steps:** On a disposable Search Endpoint, set **Requests Per Minute** to a deliberately low value (for example, 60), attach it to a case with several queries, and run the case in the foreground. Observe request timing or the endpoint's request log. Restore the setting to 0 afterward.
- **Expected:** Foreground requests are paced according to the configured limit; `0` means no throttling. The setting persists and is displayed on the endpoint show/edit page.
- **Edge cases:**
  - [ ] Confirm background/nightly execution remains single-threaded and does not incorrectly apply the foreground throttle rule.
  - [ ] Enter a negative, non-numeric, or excessively large value and confirm validation or safe normalization.

### 17.4 Execute a documented API request

- [ ] **Steps:** Generate a Personal Access Token from Profile. From the API Docs page or a terminal, call a documented read-only endpoint such as `GET /api/cases/:id.json` with `Authorization: Bearer <token>`. Confirm the response is JSON and belongs to the authenticated user. Destroy the token and repeat the request.
- **Expected:** The first request succeeds with the expected resource shape; the request after token destruction is rejected with an authentication error. No token is exposed in the response body or page markup.
- **Edge cases:**
  - [ ] Omit the bearer token and confirm the endpoint rejects the request.
  - [ ] Use a token from another user and confirm authorization prevents access to an unshared case.

### 17.5 External score ingestion

- [ ] **Steps:** Create or select a disposable case with a known query set. Use the checked-in external-evaluation example or an equivalent authenticated API request to post a score calculated outside Quepid. Reload the case and open history/snapshots.
- **Expected:** The external score is accepted for the intended case/try, appears in the case's score/history UI, and does not alter document ratings unless the submitted API operation explicitly requests that.
- **Edge cases:**
  - [ ] Submit an invalid case/try identifier and confirm a useful 4xx response without creating a partial record.
  - [ ] Repeat the same submission and confirm the documented idempotency/duplicate behavior.

### 17.6 Ollama-backed AI Judge

- [ ] **Steps:** In an environment with Ollama and a small supported model available, create or edit an AI Judge and select **Ollama**. Verify the service URL/model fields. Match the prompt's rating values to the disposable Book's scale and include a JSON example with `explanation` and `judgment`. Save it, assign it to the Book, and run a bounded judging job for one or two pairs.
- **Expected:** The AI Judge saves with the Ollama configuration, the job completes, and new judgements contain a rating and explanation attributed to that AI Judge.
- **Edge cases:**
  - [ ] If the model returns a rating outside the Book's scale, confirm it is retained as an unrateable judgement with the original value in its explanation, rather than counted as a valid rating.
  - [ ] Point the judge at an unavailable model/service and confirm the job reports a useful failure without marking unrelated pairs as rated.
  - [ ] Confirm the normal OpenAI/provider configuration remains available after switching back from Ollama.

### 17.7 Scoring semantics and metric behavior

- [ ] **Steps:** Use a disposable case with ten ordered results and a graded scorer such as NDCG@10. Rate the results with a deliberately non-monotonic sequence, then reorder the search results so the most relevant document is first. Compare the score before and after. Select a different scorer and confirm the case has one active scorer at a time.
- **Expected:** The score reflects ordering according to the selected metric; NDCG can improve substantially when highly rated documents move upward even if the ratings themselves do not change. Switching scorers changes the displayed score using the same ratings, and the selected scorer persists after reload.
- **Edge cases:**
  - [ ] Confirm the documented global NDCG behavior includes rated documents found through Explain Other, while an unrated document does not silently contribute a rating.
  - [ ] Confirm a perfect ordering can produce a perfect NDCG score even when every rating has the same low value; record this as expected metric behavior, not a UI defect.

### 17.8 Judgement consistency and rating guidance

- [ ] **Steps:** Create or open a Book with an explicit information need and a graded scorer. In two separate rater sessions, judge the same query/document pairs using the scale labels and information need. Review the Judgement Stats/audit view and the resulting score.
- **Expected:** Both raters see the same query, information need, document fields, and rating scale; ratings are attributed to the correct users, and the audit/stats view makes disagreements visible without overwriting either judgement.
- **Edge cases:**
  - [ ] Use the same document with different information needs and confirm the rating can legitimately differ.
  - [ ] Use **Judge Later** and **I Can't Tell**, then confirm these states are distinguishable from a deliberately selected relevance score.
  - [ ] Confirm the scale labels shown to raters match the scorer configuration and remain stable after reload.

### 17.9 Search-engine provider compatibility smoke test

- [ ] **Steps:** Where test credentials/endpoints are available, create one disposable Search Endpoint for each supported integration represented in the wiki/manual: Solr, Elasticsearch, OpenSearch, Search API, Vectara, and Elastic Cloud. Use the provider's documented minimal query, map the response, attach the endpoint to a disposable case, and run one query.
- **Expected:** Each configured endpoint validates, returns at least one mapped result, and supports the normal case workflow (expand query, inspect fields, and rate a result). Provider-specific failures identify the endpoint and do not leave a half-created case.
- **Edge cases:**
  - [ ] Confirm authentication headers/API keys are masked in the UI and are not echoed into result payloads or browser-visible response data.
  - [ ] Confirm an invalid provider response produces a useful mapper/error state and does not report a false successful search.
  - [ ] If a provider is unavailable in the environment, mark that provider blocked with the missing external prerequisite rather than treating the whole scenario as passed.

### 17.10 Deployment configuration smoke test

- [ ] **Steps:** In a disposable deployment, configure the documented `QUEPID_DOMAIN`/HTTPS settings and, if applicable, `RAILS_RELATIVE_URL_ROOT` for a non-root context path. Load the sign-in page, log in, open a case, run a query, open a modal, and follow a password-reset or invitation link. Verify the configured legal/cookie links, `/healthcheck`, and a transactional email link. If encrypted settings are enabled, configure one encrypted secret (for example an AI-provider key) and use the feature that reads it.
- **Expected:** Assets, relative links, redirects, Turbo/Stimulus requests, modal actions, API calls, and external links all retain the configured scheme and context path. Healthcheck reports success, email links point to the configured public origin, legal links appear only when configured, and encrypted secrets work without being rendered in plaintext.
- **Edge cases:**
  - [ ] Run the same smoke flow with no context path and confirm root-hosted URLs remain correct.
  - [ ] Confirm an HTTPS deployment cannot directly call an HTTP search endpoint unless the documented Quepid proxy path is enabled.
  - [ ] Confirm a missing/invalid encryption key fails safely at boot or configuration time rather than silently losing secrets.
  - [ ] If OAuth, SMTP/Postmark, SolidCable, or SolidQueue is configured, verify one representative login, email, realtime notification, and background-job flow; record unavailable external services as blocked prerequisites.

## Scope notes

The deployment, SSL, environment-variable, Docker, Digital Ocean, troubleshooting, and Thor pages are intentionally classified as operational coverage. They need environment-specific smoke tests and secure access to infrastructure; adding browser scenarios for them would give a false impression of coverage.
