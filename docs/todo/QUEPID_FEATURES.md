# Quepid: Complete Feature & Function Enumeration

> **Role:** Broad app-wide inventory (all surfaces, backend, infra). For the core case UI deep dive see [`QUEPID_COREUI_FEATURES.md`](./QUEPID_COREUI_FEATURES.md). For per-table schema, HTML routes, and business rules see [`complete_application_specification.md`](../complete_application_specification.md). For frontend cleanup after Angular removal see [`todo.md`](./todo.md#frontend-cleanup-after-angular-removal).
>
> **Last reviewed:** August 2026 against branch `angular-phase-10` (`Rails 8.1.3.1` / `Ruby 4.0.6` / AngularJS removed). Re-check `Gemfile`, `Gemfile.lock`, and `package.json` before citing exact versions.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Core Domain Concepts](#2-core-domain-concepts)
3. [Data Model & Relationships](#3-data-model--relationships)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [Case Management](#5-case-management)
6. [Query Management](#6-query-management)
7. [Rating & Scoring System](#7-rating--scoring-system)
8. [Book (Judgment Collection) System](#8-book-judgment-collection-system)
9. [Search Endpoint Integration](#9-search-endpoint-integration)
10. [Try (Experiment Configuration) System](#10-try-experiment-configuration-system)
11. [Snapshot & Diff System](#11-snapshot--diff-system)
12. [Team Collaboration](#12-team-collaboration)
13. [Import/Export](#13-importexport)
14. [AI Judge Integration](#14-ai-judge-integration)
15. [Mapper Wizard](#15-mapper-wizard)
16. [Admin Dashboard](#16-admin-dashboard)
17. [Analytics & Tracking](#17-analytics--tracking)
18. [Frontend Architecture](#18-frontend-architecture)
19. [Bulk Judging Interface](#19-bulk-judging-interface)
20. [Proxy & HTTP Layer](#20-proxy--http-layer)
21. [User Profile & Account Management](#21-user-profile--account-management)
22. [Background Job Processing](#22-background-job-processing)
23. [API Surface](#23-api-surface)
24. [Real-Time Features](#24-real-time-features)
25. [Configuration & Feature Flags](#25-configuration--feature-flags)
26. [Infrastructure & Deployment](#26-infrastructure--deployment)
27. [Testing Infrastructure](#27-testing-infrastructure)
28. [Splainer-Search Integration](#28-splainer-search-integration)
29. [Onboarding & Tours](#29-onboarding--tours)
30. [Analytics Visualizations](#30-analytics-visualizations)
31. [PWA & Accessibility](#31-pwa--accessibility)
32. [Jupyterlite Notebooks](#32-jupyterlite-notebooks)
33. [Frog Report (Rating Analysis Dashboard)](#33-frog-report-rating-analysis-dashboard)
34. [Health Check & Operational Endpoints](#34-health-check--operational-endpoints)
35. [Key Architectural Decisions](#35-key-architectural-decisions)

---

## 1. Application Overview

**Quepid** is a search relevance evaluation platform that allows teams to:

- Test and tune search engine configurations (Solr, Elasticsearch, OpenSearch, and custom APIs)
- Rate and judge search results for quality
- Score relevance using custom JavaScript scoring functions
- Collaborate with teams on search tuning experiments
- Collect structured human judgments for training and evaluation
- Use AI judges for automated relevance assessment
- Track scoring trends over time
- Create point-in-time snapshots of search results

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Backend Framework | Ruby on Rails 8.1.3.1 |
| Language | Ruby 4.0.6 |
| Database | MySQL 8.4.3 (utf8mb4) |
| Frontend | Stimulus + Turbo, plain ES modules in `app/javascript/utils/` (AngularJS removed) |
| CSS | Bootstrap 5.3 (`core.css` + `application.css`) |
| Job Queue | Solid Queue 1.7.0 |
| WebSockets | Solid Cable 4.0.2 + ActionCable |
| Asset Pipeline | Propshaft 1.3 + esbuild |
| Auth | Devise 5.0.4 + OmniAuth |
| JavaScript Engine | MiniRacer 0.21 (V8) for scoring/mapping |
| Visualization | Vega-Lite (QGraph, frog report, analytics); D3 + CalHeatmap in admin/analytics bundles |
| Analytics | Ahoy Matey 5.5.0 |
| BI Dashboard | Blazer 3.5.1 |
| Node (build) | Node 24.x (`package.json` engines: `>=24 <25`) |

---

## 2. Core Domain Concepts

Quepid operates around two parallel systems for relevance evaluation:

### System A: Cases (Live Search Testing)

```
User → Case → Queries → Ratings (per doc)
                  ↓
              Try (config) → SearchEndpoint
                  ↓
              Snapshot (results capture)
                  ↓
              Score (computed metric)
```

- **Case**: A container for a set of search queries being evaluated against a search engine
- **Query**: An individual search string with associated ratings
- **Rating**: A relevance score for a specific document in a query's results
- **Try**: A configuration snapshot (query params, field spec, endpoint) that can be iterated
- **Scorer**: A JavaScript function that computes a relevance metric (e.g., AP@10, nDCG@10)
- **Snapshot**: A frozen point-in-time capture of search results
- **Score**: A computed metric value for a case at a point in time

### System B: Books (Offline Judgment Collection)

```
User → Book → QueryDocPairs → Judgements (per user)
                                  ↓
                              AI Judges (automated)
```

- **Book**: A collection of query-document pairs for structured judgment
- **QueryDocPair**: A specific query + document combination to be judged
- **Judgement**: A human or AI rating of a query-document pair
- **AI Judge**: An LLM-powered automated judge

### Shared Concepts

- **Team**: A group of users who share cases, books, scorers, and search endpoints
- **SearchEndpoint**: A configured connection to a search engine
- **Scorer**: A reusable scoring algorithm (JavaScript-based)

---

## 3. Data Model & Relationships

**Domain narrative:** [`data_mapping.md`](./data_mapping.md) and [`erd.png`](./erd.png).

**Per-table schema (columns, associations, scopes):** [`complete_application_specification.md` §3](../complete_application_specification.md#3-data-model).

**Case UI implementation quirks:** [`core_ui_implementation_reference.md`](../core_ui_implementation_reference.md). **Edge-case business rules:** [`complete_application_specification.md` § Edge Cases](../complete_application_specification.md#edge-cases-and-business-rules).

The complete schema, including application, join, and framework tables, is maintained in
[`complete_application_specification.md` §3](../complete_application_specification.md#3-data-model).
Use that section as the authoritative source for columns, associations, and migration details.

---

## 4. Authentication & Authorization

### Authentication Methods

| Method | Mechanism | Details |
|--------|-----------|---------|
| Email/Password | BCrypt + Sessions | Hand-rolled login (not Devise `database_authenticatable`); BCrypt comparison done directly; CSRF skipped on login; `num_logins` counter incremented |
| API Key | HMAC-SHA256 Token | HTTP Bearer token via Authorization header |
| Google OAuth | OmniAuth | omniauth-google-oauth2 gem |
| Keycloak SSO | OmniAuth | omniauth_openid_connect gem |
| Generic OpenID Connect | OmniAuth | Any OIDC provider; configured with `OPENID_CONNECT_BASE_URL`, `_CLIENT_ID`, `_CLIENT_SECRET` and `_ISSUER` (all four required), plus optional `OPENID_CONNECT_BUTTON_TEXT` (default "Sign in with OpenID Connect"). Separate from the Keycloak and Google options |
| Invitation | Devise Invitable | Email invitation with token |

### Password & Security

| Feature | Details |
|---------|---------|
| Hashing | BCrypt with 10 stretches (1 in test) |
| Length | 8-72 characters |
| Reset Window | 6-hour token expiry |
| No Auto-Login | Manual login required after password reset |
| Encryption | ActiveRecord encryption for `llm_key` (deterministic: false) |
| Parameter Filtering | password, email, secret, token, crypt, salt, certificate, OTP, SSN, CVV filtered from logs |

### Authorization Features

- **Role-Based**: Administrator flag on User model
- **Resource Ownership**: Cases, Books, Scorers, SearchEndpoints have owner_id
- **Team-Based Sharing**: Resources shared via Team join tables
- **Public Access**: Cases can be marked public with encrypted shareable IDs (MessageVerifier)
- **Account Locking**: Admin can lock/unlock user accounts (clears session, returns 401)
- **Feature Flags**: SIGNUP_ENABLED, EMAIL_LOGIN_ENABLED, COMMUNAL_SCORERS_ONLY, SEARCH_ENDPOINT_VIEWS_ADMIN_ONLY
- **No Authorization Framework**: Custom implementation via concerns (no Pundit/CanCanCan)

### CORS & Security Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| CORS | `origins '*'`, all methods, all resources | Fully open; `credentials: false` |
| CSRF Protection | Weakened in places | `ApplicationController` still protects; production `default_protect_from_forgery = false`; API uses `:null_session`; ActionCable forgery off |
| HSTS | Disabled | `hsts: false` |
| Session Cookies | Not Secure-flagged | `secure_cookies: false` even when SSL forced |
| CSP | Minimal | Only `font_src :self, :https, :data` enforced |
| ActionCable | Any origin accepted | `allowed_request_origins = '*'` in all environments |
| SSL | Optional | Force SSL via env var; exempts `/api/*`, `/assets/*`, `/case*`, root `/` |
| AR Encryption Keys | Hardcoded defaults | Fallback keys if env vars not set — must be overridden in production |

### Access Control Pattern (ForUserScope)

Resources are accessible via:
1. Direct ownership (`owner_id = current_user.id`)
2. Team membership (user belongs to a team that has access to the resource)

```ruby
scope :for_user, ->(user) do
  direct = where(owner: user)
  by_team = left_joins(teams: :members).where(teams_members: { member_id: user.id })
  by_team.or(direct).distinct
end
```

---

## 5. Case Management

### Features

| Feature | Description |
|---------|-------------|
| CRUD Operations | Create, read, update, delete cases |
| Archiving | Soft-delete via `archived` boolean (recoverable) |
| Public Sharing | Cases can be made public with encrypted shareable IDs |
| Cloning | Deep clone with options: preserve history, clone queries, clone ratings |
| Scorer Assignment | Each case has a default scorer (falls back to system default) |
| Book Linking | Cases can be linked to Books for judgment syncing |
| Nightly Evaluation | Cases can be flagged for automated nightly runs; toggleable via `updateNightly()` |
| Background Evaluation | `runCaseInBackground()` queues a server-side batch scoring job (separate from live browser scoring) |
| Metadata Tracking | Per-user last_viewed_at timestamps |
| Recent Cases | Dropdown showing 4 most recently viewed cases. The core case page uses hard-navigation variants (`dropdown/cases_core`, `dropdown/books_core`) rendered without a layout |
| Book Summary Detail | `home#book_summary_detail` (`/home/book_summary_detail/:book_id`) renders a book's summary on the home page |
| Query Arrangement | Drag-and-drop ordering via fractional indexing |
| Score History | Time-series tracking of case scores |
| Score History Page | `scores#index` lists a case's scores (filterable by scorer, paginated); `scores#destroy_multiple` bulk-deletes selected scores |
| Ratings Page | `ratings#index` lists a case's ratings with a text search over query, doc ID and rating; linked as "Check Ratings" from the History tab |
| Delete All Queries | `cases#destroy_queries` removes every query in a case; reached from the delete/archive options menu on the case toolbar |
| Public/Private Toggle (Analytics) | The tries-visualization analytics page can flip a case between public and private (`analytics/cases/visibilities#update`) |
| Server-Rendered Case Header | The core case header is a Turbo Frame: `GET /case/:id/header`, `PATCH …/header/case_name`, `PATCH …/header/try_name/:try_number` |
| Annotations | Notes attached to specific scores |
| Name Grouping (Disabled) | Colon-delimited prefix grouping (e.g., "Typeahead: Dairy", "Typeahead: Meats" → "Typeahead" group); currently **commented out** in HomeController due to performance issues |

### Case Lifecycle

```
Create → Configure Tries → Add Queries → Rate Documents → Score →
         ↓                                                    ↓
    Archive/Unarchive                                   Snapshot
         ↓                                                    ↓
       Clone                                          Compare
```

---

## 6. Query Management

### Features

| Feature | Description |
|---------|-------------|
| CRUD Operations | Create, read, update, delete individual queries |
| Bulk Operations | Bulk create and bulk delete queries |
| Deduplication | Prevents duplicate query_text within a case |
| Ordering | Fractional indexing for drag-and-drop reordering (ui.sortable) |
| Move Between Cases | Queries can be moved to a different case |
| Information Need | Optional textual description of what the query seeks |
| Notes | Freeform notes per query |
| Options | JSON options per query |
| Case-Sensitive | query_text stored with case-sensitive collation (utf8mb4_bin) |
| Max Length | 2048 characters per query |
| Rated-Only Filter | Toggle to show only documents that have been rated |
| Concurrent Search | Worker pool of 10 parallel search requests; search and score phases are separated for incremental progress display |
| Rate Limiting | When `requestsPerMinute > 0`, queries execute sequentially with calculated delays (`60000 / rpm` ms between each) |
| Query State Tracking | States: loading, error, loaded, no results |
| Book Syncing | Auto-syncs query-doc pairs to associated books (batched in groups of 100, dispatched in parallel) |
| Score Version Cache | Tracks `lastScoreVersion` per query; skips re-scoring if version unchanged |
| Filter-to-Rated Mode | Modifies search query to filter by rated doc IDs: Solr uses `{!terms f=id}`, ES/OS uses `terms` filter in `bool` query |
| TLS Protocol Switching | Detects HTTP/HTTPS mismatch between Quepid and search engine; offers protocol redirect to avoid mixed-content blocking |
| Solr Typo Detection | Warns on 7 common Solr parameter camelCase typos (e.g., `deftype` vs `defType`, `echoparams` vs `echoParams`) |
| ES Template Warning | Detects and warns when query params look like an Elasticsearch search template call |
| Sort Modes | 5 sort modes for query list: default (arrangement order), modified, query text, score, error (surfaces errors and unrated queries first) |
| Query Pagination | 15 queries per page with drag-to-reorder working across pagination boundaries |
| Doc Finder | "Find Documents Not in Results" panel: shows rated docs not in current results, supports bulk-rating of all found docs |

### Query Arrangement System

Uses a custom fractional indexing algorithm:
- `arranged_at` and `arranged_next` fields (bigint)
- Position range: 0 to 9,223,372,036,854,775,807
- Efficient insert/move without renumbering all items
- Automatic normalization when positions get too close

---

## 7. Rating & Scoring System

### Rating Features

| Feature | Description |
|---------|-------------|
| Per-Query Ratings | Each query has ratings for specific doc_ids; stored in per-query `RatingsStore` on the client |
| Floating Point | Ratings are floats (support decimal scales); client normalizes string ratings to integers |
| User Attribution | Optional user_id per rating |
| Bulk Rating | Bulk create/update/delete ratings; bulk delete goes through POST because DELETE requests don't carry a body |
| Null Ratings | Support for partially-rated result sets |
| Cross-System Sync | Ratings sync between Cases and Books via RatingsManager |
| Dirty Tracking | Client-side version counter per RatingsStore and global; `rating-changed` event triggers `scoreAll()` re-scoring |
| Immediate Persistence | Every rating change fires an immediate HTTP PUT — no debouncing |

### Scorer Features

| Feature | Description |
|---------|-------------|
| Custom JavaScript | Scoring functions written in JavaScript; `while`/`for` loops prohibited (must use `eachDoc()` to prevent infinite loops) |
| V8 Execution (Server) | Runs in MiniRacer V8 context for server-side scoring (snapshots, evaluations) |
| Client-Side Scoring | ScorerFactory executes scoring functions in the browser for real-time feedback |
| Configurable Scale | Array of integer values (max 10 items) |
| Scale Labels | JSON labels for scale values |
| Scale-to-Color Mapping | Automatic color coding for each scale value in the UI |
| Communal Scorers | System-wide shared scorers (admin-managed) |
| User-Owned Scorers | Private scorers per user |
| Team-Shared Scorers | Shared via team membership |
| System Default | Configurable default scorer (e.g., AP@10) |
| Scorer Cloning | Duplicate an existing scorer |
| Code Editor | CodeMirror 6 (`modules/editor.js`) for editing scorer code |
| Built-in Metrics | 7 communal scorers seeded: **nDCG@10**, **DCG@10**, **CG@10** (scale 0-3: Poor/Fair/Good/Perfect), **P@10**, **AP@10**, **RR@10** (scale 0-1: Irrelevant/Relevant), **ERR@10** (scale 0-3); plus legacy **v1** scorer (`avgRating100 - editDistanceFromBest`); also `nDCG_CUT@10` variant (ideal DCG cut at k vs. all judged docs); each as a JavaScript file in `db/scorers/` |

### Scorer Runtime API

All scorers (both client-side and server-side) have access to these helper functions:

| Function | Description |
|----------|-------------|
| `eachDoc(fn, k)` | Loop over top-k returned docs |
| `eachDocWithRating(fn)` | Loop over ALL rated docs (not just top-k) |
| `eachRatedDoc(fn, k)` | Loop over top-k rated docs only (client and server) |
| `eachDocWithRatingEqualTo(score, fn)` | Loop over docs matching a specific rating |
| `hasDocRating(i)` | Check if doc at position i has a rating |
| `docRating(i)` | Get rating for doc at position i |
| `docAt(i)` | Access doc object at position i (rich client-side / plain server-side) |
| `numFound()` | Total number found by search engine |
| `numReturned()` | Number of docs actually returned |
| `topRatings(k)` | Get top-k sorted ratings from bestDocs |
| `avgRating(k)` / `avgRating100(k)` | Average rating of top-k (plain / scaled to 0-100; client-side only) |
| `editDistanceFromBest(k)` | Edit distance from ideal ranking (client-side only, used by legacy v1 scorer) |
| `setScore(score)` | Set the final score value |
| `pass()` / `fail()` | Unit-test-style assertions for per-query pass/fail scorers |
| `assert(cond)` / `assertOrScore(cond, score)` | Conditional scoring assertions |
| `max` | The scorer's maximum rating value |
| `qOption(key)` | Read query-level options |

### Dual Execution Model

| Context | Engine | Entry Point | Key Difference |
|---------|--------|-------------|----------------|
| Client-side | `new Function`, scheduled with `queueMicrotask` | `utils/scorer_runtime.js` `runCode()` | `docAt()` returns rich splainer-search doc objects |
| Server-side | MiniRacer (V8) | `JavascriptScorer.score()` | `docAt()` returns plain JS objects; `lib/scorer_logic.js` provides helpers |

Client-side scoring clips negative scores to 0. There is no upper bound: scores are not capped at the rating scale max (CG@10, DCG@10, and v1 routinely exceed it). Returns `'zsr'` for zero search results, `'--'` for no ratings. Case score is the average of all non-zsr/non-`--` per-query scores.

### Score Calculation Pipeline

1. Execute search query against search endpoint
2. Retrieve document results with positions
3. Match results against existing ratings
4. Build `docs[]` array (with ratings) and `bestDocs[]` array (all rated docs, sorted desc)
5. Execute scorer JavaScript code in V8 (server) or eval (browser)
6. Store per-query scores and overall case score (arithmetic average)
7. Handle NaN results (unrated documents)

### Score Storage & Deduplication

- Time-series tracking in `case_scores` table
- **Smart deduplication (CaseScoreManager)**:
  - Same try/user/scorer within 5 minutes with different value → update existing score (user is actively rating)
  - Same score as last time within 1 day with no new queries → ignore (no-op)
  - Otherwise → create new Score record
- Sampling for performance: random sampling for cases with 60,000+ scores
- Sparkline visualization on home page
- Prophet-based trend analysis and change point detection
- Per-query score breakdowns stored as JSON in a binary (BLOB) column

---

## 8. Book (Judgment Collection) System

### Features

| Feature | Description |
|---------|-------------|
| CRUD Operations | Create, read, update, delete books |
| Archiving | Soft-delete with archive/unarchive |
| Configurable Scale | Custom judgment scale (e.g., [0,1,2,3] or [0,1]) |
| Scale Labels | Human-readable labels for each scale value |
| Scale Lock | Scale cannot be changed once judgements exist (labels can) |
| Scoring Guidelines | Markdown guidelines for human judges (rendered in judging UI) |
| Default Guidelines | Templates for 2-point and 4-point scales |
| Show Rank | Option to show document rank to judges |
| Implicit Judgements | Support for implicit judgment signals |
| AI Judges | Assign LLM-powered judges to books; "Prepare to Judge" triggers Unleash modal; "Unleash the Kraken!!" mode judges all pairs; confetti celebration on completion |
| Import/Export | JSON + ZIP format for book data |
| Populate from Case | Populate book with query-doc pairs from a case snapshot |
| Refresh to Case | Sync judgments back to case ratings |
| Combine Books | Merge query-doc pairs and judgements from multiple books |
| Delete Below Position | Remove query-doc pairs beyond a specific rank position |
| Judgement Stats | Leaderboard with Vega-Lite bar chart showing judges vs judgement counts |
| Remap Ratings | `remap_judgement_ratings` (form on the book edit page) maps old → new rating values across the book's judgements and linked case ratings in one transaction; a single SQL `CASE` update means chained remaps (5→4, 4→3) can't double-apply |
| Delete Ratings by Assignee | `delete_ratings_by_assignee` deletes all of one user's judgements in the book and queues `UpdateCaseJob` |
| Reset Unrateable | Admin can reset "unrateable" flags per user |
| Reset Judge Later | Admin can reset "judge later" flags per user |
| Assign Anonymous | Reassign anonymous judgements to a specific user |
| Tab Navigation | Overview, Query/Doc Pairs, Judgement Stats, Judgements, Import, Share, Export, Settings |

### QueryDocPair Features

| Feature | Description |
|---------|-------------|
| CRUD Operations | Create, read, update, delete pairs |
| Document Fields | Store document metadata as JSON |
| Position Tracking | Track document position in search results |
| Information Need | Describe what the query is looking for |
| Notes | Freeform notes per pair |
| Selection Strategy | Position-weighted random selection for judging |

### Judgement Features

| Feature | Description |
|---------|-------------|
| Multi-Rater | Up to 3 judgments per query-doc pair |
| One Per User | Each user can only judge a pair once |
| Rating | Numeric score from the book's scale |
| Explanation | Text explanation for the rating (with "I Can't Tell" modal opening an explanation textarea) |
| Judge Later | Flag to defer judgment (skip current pair) |
| Unrateable | Mark pair as unrateable with optional explanation |
| AI Judgements | Automated judgments from LLM judges |
| CSV Export | Export judgments with judge columns (CSV injection protected) |
| Anonymous Judges | Support for user_id = nil |
| Keyboard Shortcuts | Rating via keyboard (A, S, D, F, G, H, J, K, L, ; keys map to scale values) |
| Session Tracking | Tracks judging progress within a session |
| Filtering | Filter judgements by judge, unrateable status, judge_later status, full-text search |
| Compact Mode | Toggle compact table view for judgement lists |
| Document Thumbnails | Auto-detects and displays image/thumbnail fields from document data |

### Selection Strategy (Multiple Raters)

```
1. Find pairs not yet judged by current user
2. Filter to pairs with < 3 total judgments
3. Prioritize unjudged pairs over partially-judged
4. Position-weighted randomization: LOG(1.0 - RAND()) * (position + 1)
5. Return selected pair for judging
```

### Rating Calculation from Judgements

```
If < 3 judgements: average all ratings
If >= 3 judgements:
  Take top 3 ratings
  If all agree: use that rating
  If disagree: use minimum (pessimistic approach)
```

---

## 9. Search Endpoint Integration

### Supported Search Engines

| Engine | API Method | Parser | Notes |
|--------|-----------|--------|-------|
| Solr | GET/JSONP | SolrArgParser | Full debug/explain support; `echoParams=all` auto-injected |
| Elasticsearch | POST | EsArgParser | JSON query body; explain extraction via `esExplainExtractorSvc` |
| OpenSearch | POST | EsArgParser | Same as Elasticsearch |
| Vectara | POST | EsArgParser | Compatible query format |
| Algolia | POST | EsArgParser | JSON query support |
| SearchAPI | GET/POST | Auto-detect | Custom mapper code; `new Function(mapperCode).call(window)` executes mapper in global scope; JSON vs Solr format auto-detected |
| Static | GET | SolrArgParser | For static result sets; silently remapped to Solr engine internally |

**Mapper-based search engines:** presets built on SearchAPI, defined by `MapperBasedSearchEngine` ([`mapper_based_search_engine.rb`](../../app/models/mapper_based_search_engine.rb)) with mapper code in `db/mapper_based_search_engines/` (currently Vespa). `GET /api/mapper_based_search_engines` lists them and they appear in the wizard's engine dropdown. Each preset carries capability flags — `supports_pagination` (with the hits/offset parameter names), rated-docs lookup, `supports_basic_auth`, default `api_method` and `proxy_requests`.

### Endpoint Configuration

| Field | Description |
|-------|-------------|
| endpoint_url | Full URL to search server (500 chars) |
| search_engine | Engine type identifier |
| api_method | GET, POST, or JSONP |
| mapper_code | Custom JavaScript for response transformation |
| custom_headers | JSON headers for requests |
| basic_auth_credential | Authentication string |
| proxy_requests | Route through Quepid server (boolean) |
| requests_per_minute | Rate limiting (0 = unlimited) |
| test_query | Sample query for testing configuration |
| options | JSON options for engine-specific settings |
| archived | Soft-delete flag |

### Additional Endpoint Features

| Feature | Description |
|---------|-------------|
| Proxy Mode | Routes requests through Quepid server (for CORS/protocol issues); incompatible with JSONP |
| Credential Masking | The `MaskableCredential` concern validates `basic_auth_credential` as `username:password`, shows it masked (`user:******`) in HTML forms, and — when `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is on — omits it from JSON API responses so it never reaches the browser |
| Required Proxy for Basic Auth | With `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS=true`, endpoints with basic-auth credentials must enable `proxy_requests`; existing offenders are listed in a boot-time warning and fail validation when edited |
| Endpoint Lookups | `GET /api/cases/:id/search_endpoints` lists the endpoints available to a case |
| Cloning | Duplicate an existing search endpoint configuration |
| Archiving | Soft-delete with archive/unarchive |
| Team Sharing | Share endpoints across teams |
| Filtering | Filter by name/URL, owned/shared, archived status, team |
| Search Engine Icons | Dynamically loaded engine-specific icons in the UI |
| Querqy Detection | Detects Querqy rewriting signals (`querqy.rewrite` or `querqy.infoLog`) in Solr/ES debug responses and displays a Querqy icon next to affected results (read-only, no SMUI integration) |

---

## 10. Try (Experiment Configuration) System

### Features

| Feature | Description |
|---------|-------------|
| Sequential Numbering | Each try has a try_number within its case |
| Ancestry Tree | Hierarchical parent-child relationships (ancestry gem) |
| Query Parameters | Up to 20KB of query params text |
| Field Specification | Defines which fields to display in results |
| Escape Query | Toggle for URL-encoding query text |
| Number of Rows | Configurable result count (default: 10) |
| Search Endpoint Link | Each try connects to a search endpoint |
| Preview Args | `POST /api/cases/:case_id/tries/:try_number/preview_args` parses a try's params without persisting them (used by the missing-documents finder) |
| Curator Variables | Dynamic named parameters (name → float value) |
| Options Merging | Case options + SearchEndpoint options (SE wins) |
| Ancestry Overflow | Ancestry column is `string(3072)`; when path exceeds limit, catches `ActiveRecord::ValueTooLong` and restarts chain (`parent = nil`); orphan strategy is `:adopt` |

### Argument Parsing

Tries convert their `query_params` string into engine-specific arguments:

- **SolrArgParser**: Parses `key=value&key=value` format, supports multi-valued params
- **EsArgParser**: Parses JSON query body
- Both support `##variable##` syntax for curator variable substitution
- Both escape `%` characters for sprintf compatibility

---

## 11. Snapshot & Diff System

### Snapshot Features

| Feature | Description |
|---------|-------------|
| Create Snapshot | Capture current search results for all queries |
| Named Snapshots | Customizable names (default: "Snapshot MM/DD/YY") |
| Shallow Mode | List snapshots without detailed docs (performance) |
| Latest Shortcut | Fetch most recent snapshot by name "latest" |
| Compression | Marshal dump + Zlib compression for storage |
| ActiveStorage | Snapshot files stored via database-backed ActiveStorage |
| Import | Import snapshots from external sources |
| Auto-Cleanup | Keeps first snapshot + most recent 10 per case (deletes middle ones); Haystack special snapshots [2471, 2473] are permanently exempt |
| Public Access | Public cases allow unauthenticated snapshot access |
| Scorer Association | Each snapshot records which scorer was used |
| Snapshot Search | Can search queries using saved snapshot data instead of live engine |
| Fake Solr Endpoint | For engines without doc-lookup support (Vectara, SearchAPI), the snapshot system hijacks a fake Solr endpoint pointed at `api/cases/:caseNo/snapshots/:snapshotId/search` — Quepid serves a Solr-compatible response from its own snapshot data |
| Document Field Recording | `recordDocumentFields` option: when true, stores full document fields; when false, stores only doc_id and explain; forced true for engines without doc-lookup support; `--` scores converted to null before persisting |
| Large Snapshot Support | `hasSnapshotFile` flag for file-backed snapshots stored via ActiveStorage (database-backed) |

### Snapshot Data Structure

```
Snapshot
├── SnapshotQuery (per query)
│   ├── score (float)
│   ├── all_rated (boolean)
│   ├── number_of_results (integer)
│   ├── response_status (HTTP code)
│   ├── WebRequest (raw HTTP request/response)
│   └── SnapshotDoc[] (per document)
│       ├── doc_id
│       ├── position
│       ├── explain (search engine explanation)
│       ├── fields (document field values)
│       └── rated_only (boolean)
```

### Diff / Comparison System

| Feature | Description |
|---------|-------------|
| Multi-Snapshot Diff | Compare up to 5 snapshots simultaneously via `diffStateStore` (source of truth for active diffs) |
| Query-Level Diff | Per-query comparison of result sets between snapshots using `SnapshotSearcher` instances |
| Score Comparison | Compare scores across snapshots; each snapshot searcher gets a `diffScore` and `currentScore` property |
| Result Position Tracking | Track how document positions change between snapshots |
| Visual Diff | Side-by-side result comparison in the UI (queryDiffResults directive) |
| Backward Compatibility | Single-diff mode populates `query.diff`; multi-diff mode uses `query.diffs[]` array |

---

## 12. Team Collaboration

### Features

| Feature | Description |
|---------|-------------|
| Team CRUD | Create, rename, delete teams |
| Member Management | Add/remove members by email or user ID |
| Invitation System | Invite new users via email (Devise Invitable) |
| Share Cases | Share cases with team (auto-shares search endpoint) |
| Share Books | Share books with team |
| Share Scorers | Share scoring functions with team |
| Share Search Endpoints | Share endpoint configurations with team |
| Unique Names | Team names must be globally unique |
| Member Suggestions | `teams#suggest_members` returns autocomplete suggestions from users in the current user's teams |
| Per-Team Archiving | Cases and search endpoints can be archived/unarchived within a team (`teams#archive_case`, `unarchive_case`, `archive_search_endpoint`, `unarchive_search_endpoint`) |
| Team Books | `GET /api/teams/:id/books` lists a team's books |

### Sharing Model

```
Team ←→ Members (users)
Team ←→ Cases
Team ←→ Books
Team ←→ Scorers
Team ←→ SearchEndpoints
```

All shared resources become accessible to all team members via the `ForUserScope` concern.

---

## 13. Import/Export

### Export Formats

| Resource | Format | Async | Details |
|----------|--------|-------|---------|
| Cases | JSON | No | Case name, scorer, queries, ratings, tries |
| Books | JSON (ZIP) | Yes | Name, scale, query_doc_pairs, judgements; via ExportBookJob; creates downloadable ActiveStorage blob with progress broadcast |
| Ratings | CSV/JSON | No | query_text, doc_id, rating |
| Queries | JSON | No | Information needs export |
| Snapshots | Binary | No | Marshal + Zlib compressed |

### Case Export Sub-Formats (Client-Side)

The case export JavaScript generates multiple CSV formats locally in the browser:

| Format | Description |
|--------|-------------|
| General | Standard CSV with queries and ratings |
| Detailed | Extended CSV with additional metadata |
| Snapshot | Export from a specific saved snapshot |
| Basic | Minimal query/rating data |
| TREC | TREC format: `<query_id> 0 <doc_id> <rating>` (only fully-rated docs); also supports TREC-from-snapshot variant |
| Quepid | Quepid-native format |
| RRE | Rated Ranking Evaluator format (Elasticsearch) |
| LTR | Learning-to-Rank format: `<rating> qid:<query_id> # <doc_id> <query_text>` |
| Information Need | Query metadata and information needs |

Exports fetch fresh data from the API before generating to capture other users' recent changes.

### API Export Formats

| Endpoint | Format |
|----------|--------|
| `GET /api/v1/export/ratings/:id` | CSV or JSON |
| `GET /api/v1/export/ratings/:id` (RRE) | JSON with `id_field`, `index`, `template`, `relevant_documents` structure |
| `GET /api/v1/export/queries/information_needs` | CSV |
| `GET /api/v1/judgements` | CSV with per-judge columns (CSV injection protected) |
| `GET /admin/users` | CSV or JSON |
| `GET /analytics/sparkline/vega_data` | CSV |

### Import Formats

| Resource | Format | Async | Service |
|----------|--------|-------|---------|
| Cases | JSON | No | CaseImporter |
| Books | JSON (ZIP) | Yes | BookImporter via ImportBookJob |
| Ratings — Quepid CSV | CSV (query, docid, rating) | No | RatingsImporter |
| Ratings — RRE Format | Elasticsearch Relevant Ranking Evaluation format | No | RatingsImporter |
| Ratings — LTR Format | Learning-to-Rank format | No | RatingsImporter |
| Queries | CSV/JSON | No | Information needs import |
| Snapshots | Binary | Yes | SnapshotImporter via PopulateSnapshotJob |

### Import Options

- **Force Create Users**: Optionally create missing users during book import
- **Clear Existing**: Option to clear existing ratings before import
- **Auto-Create Queries**: Create missing queries during rating import

### CSV Safety

Export includes CSV injection protection via `make_csv_safe()` method.

---

## 14. AI Judge Integration

### Features

| Feature | Description |
|---------|-------------|
| AI Judge Users | Special users with `llm_key` (encrypted at rest) and `system_prompt` |
| AI Judge CRUD | Dedicated controller for creating, editing, and deleting AI judges |
| Prompt Editor | Edit system prompts with sample query-doc pair preview and live LLM testing |
| LLM Service | Provider-agnostic OpenAI-compatible API (`POST /v1/chat/completions`); configurable URL, model, and timeout; auth header omitted when key is blank (enables keyless local providers like Ollama) |
| Automated Judging | RunJudgeJudyJob processes query-doc pairs |
| Batch Mode | Judge a specified number of pairs or all pairs ("Unleash the Kraken!!" mode) |
| Retry Logic | Exponential backoff via Faraday retry for rate limit (429) errors |
| Image Support | Can include image URLs in judgment prompts (multi-modal) |
| Unrateable Detection | Auto-marks unrateable pairs |
| Real-Time Progress | Turbo Stream broadcasts during judging (per-pair completion) |
| Multi-Book Assignment | AI judges assigned to books via join table |
| Rating Sync | Judgments automatically sync to case ratings via UpdateCaseJob |
| Bulk Rating Override | "Eric Steered Us Wrong" feature: bulk-update all judge_later judgements to a specific rating |
| Judge Options | Per-user JSON options for AI judge configuration |
| Team Assignment | AI judges auto-assigned to team on creation |

### AI Judge Flow

```
1. Select unrated query-doc pair (SelectionStrategy)
2. Build prompt: system_prompt + document_fields + information_need
3. Call OpenAI-compatible API (default GPT-4o; Ollama, Gemini, etc. via URL config)
4. Parse rating from response
5. Create/update Judgement record
6. Broadcast progress via Turbo Stream
7. Repeat until done
8. Trigger UpdateCaseJob to sync ratings
```

---

## 15. Mapper Wizard

### 4-Step Wizard Process

| Step | Name | Description |
|------|------|-------------|
| 1 | Fetch Search Results | Enter URL, HTTP method (GET/POST), test query, optional basic auth & custom headers; fetches and previews HTML/JSON |
| 2 | Generate Mappers with AI | Provide OpenAI API key; AI generates `numberOfResultsMapper` and `docsMapper` JavaScript functions |
| 3 | Edit, Test & Refine | CodeMirror editors for each mapper with Test, Refine with AI, and console log viewing |
| 4 | Save Search Endpoint | Name the endpoint, toggle proxy requests, assign to teams, save configuration |

### Features

| Feature | Description |
|---------|-------------|
| URL Fetch | Fetch HTML/JSON from search endpoint URLs |
| Auth Support | Basic auth and custom headers (CodeMirror JSON editor) |
| GET/POST | Support for both HTTP methods with context-sensitive placeholders |
| AI Generation | LLM-powered mapper code generation (GPT-4o via RubyLLM) |
| Test Mapper | Execute mapper against fetched content in V8 with result display |
| Refine Mapper | AI-assisted improvement based on user feedback |
| Console Logging | Capture and display console.log/error/warn output from mappers |
| Per-User State | Wizard state persisted per user (MapperWizardState model) |
| Two Mappers | `numberOfResultsMapper` and `docsMapper` functions |
| HTML/JSON Preview | Expandable preview of fetched content with copy button |

### Mapper Functions

```javascript
// numberOfResultsMapper: Extract total result count
function numberOfResultsMapper(data) {
  return totalResultCount;
}

// docsMapper: Extract document array
function docsMapper(data) {
  return [{ id: "...", title: "..." }, ...];
}
```

### RubyLLM Tools (used by Mapper Wizard AI)

| Tool | Purpose |
|------|---------|
| MapperTool | Executes JavaScript mappers via V8, returns extracted docs and counts |
| DownloadPage | Downloads web pages with auth and custom headers |
| JavascriptExtractor | Extracts JavaScript code blocks from LLM markdown responses |

---

## 16. Admin Dashboard

### Features

| Feature | Description |
|---------|-------------|
| User Management | List, search, create, edit, delete users with CSV/JSON export |
| User Locking | Lock/unlock user accounts (locked users get 401 on all requests) |
| User Pulse | Per-user activity dashboard with 6 Cal Heatmap visualizations (12-month) covering: cases viewed, cases scored, cases created, queries created, books created, judgments created |
| CSV/JSON Export | Export user list in multiple formats |
| Password Import | Create users with pre-encrypted passwords |
| Communal Scorers | Manage system-wide shared scorers |
| Announcements | Create/manage system announcements (one live at a time, publish/unpublish) |
| Announcement Tracking | Track which users have viewed announcements |
| Judgement Reassignment | Reassign user's judgments to anonymous |
| MissionControl | Monitor Solid Queue jobs (mounted at `/admin/jobs`) |
| Blazer | BI analytics with SQL queries (mounted at `/admin/blazer`) |
| WebSocket Tester | Test WebSocket/ActionCable connectivity; triggers a background job that counts down and pushes updates via Turbo Streams; displays current ActionCable config |
| Pagination | Pagy-based pagination for user lists |
| Admin Constraint | Routes protected by `AdminConstraint` (checks `user.administrator`) |
| Case Evaluation | Admin can trigger case evaluations |

---

## 17. Analytics & Tracking

### Ahoy Integration

| Tracking | Details |
|----------|---------|
| Visits | Browser, device, OS, geolocation, UTM params, referrer |
| Events | Custom event tracking on all major actions |
| User Attribution | Events linked to user accounts |
| Session Tracking | Visit/visitor tokens for session management |

### Analytics Tracking Module

Dedicated tracker classes in `app/lib/analytics/tracker/` for each domain:

| Tracker | Events Tracked |
|---------|---------------|
| Case Tracker | Create, update, delete, archive, clone, share |
| Query Tracker | Create, update, delete, move, bulk operations |
| Rating Tracker | Create, update, delete, bulk operations |
| Scorer Tracker | Create, update, delete, share |
| Snapshot Tracker | Create, delete |
| Team Tracker | Create, update, delete, member add/remove |
| Try Tracker | Create, update, delete |
| User Tracker | Login, signup, password change, profile update |
| Book Tracker | Populate, refresh, export, import |

### Prophet Analysis

- **prophet-rb** gem for Ruby-native time-series forecasting
- Trend analysis on case scores over time
- Automatic change point detection for significant score shifts
- Anomaly detection for Blazer health checks
- Available on home page per-case via Turbo Frames

### Blazer BI Dashboard

| Feature | Details |
|---------|---------|
| SQL Queries | Direct SQL queries against the database |
| Audit Trail | Query execution logging |
| User Tracking | Tracks who runs which queries |
| Health Checks | Automated database health monitoring |
| Slack Integration | Webhook notifications for failing checks |
| Forecasting | Prophet-based forecasting for metrics |

---

## 18. Frontend Architecture

### Frontend Layout

AngularJS has been removed. There is no `angular` package, Angular build script or Angular template bundle.

**Core case page (`/case/:id`)**:
- Plain ES modules in `app/javascript/utils/` (query, scoring, doc cache, diff, export and search-engine runtimes) plus stores in `app/javascript/stores/` and API helpers in `app/javascript/api/`
- Roughly 67 Stimulus controllers drive the UI
- Bundled by esbuild into `core_vendor.js` and `core_case.js`
- Bootstrap 5 CSS (`core.css` + `bootstrap5-compat.css`)

**Other pages (home, admin, analytics, books, profiles, judgements, bulk judge, search endpoints, mapper wizard)**:
- Stimulus + Turbo, Bootstrap 5 CSS (`application.css`)
- CodeMirror 6 for code editing (scorer code, JSON formatting, mapper code, query params, headers); ACE remains only in the missing-documents finder
- Turbo Frames for partial page updates (case sparklines, book dropdowns, modals, case header)
- Turbo Streams for real-time WebSocket-driven updates

**Key Stimulus Controllers**:
- `bulk-judgement` - Auto-save ratings and explanations (debounced 1s for text, immediate for clicks); visual save-state indicators (saving/saved/reset/error/typing)
- `mapper-wizard` - Full 4-step wizard: URL fetch → AI generation → test/refine → save; OpenAI API key entered per-session, never stored
- `document-fields-modal` - Pretty-printed JSON document field inspection modal
- `scoring-guidelines` - Auto-populates guidelines when scale changes (2-point vs 4-point presets)
- `user-activity` - Renders GitHub-style Cal Heatmap on admin user pulse pages
- `confetti` - Triggers `party-js` confetti animation on the "Kraken Unleashed" celebration modal
- `prompt-form` - Handles AI judge prompt submission with loading spinner

### Routes

Only the case page is a client-driven surface: `/case/:caseNo` and `/case/:caseNo/try/:tryNo`. Case listing, import, teams and scorers (`/cases`, `/cases/import`, `/teams`, `/scorers`) are Rails-rendered pages.

### Client-Side Caching & Services

Former Angular services are now modules in `app/javascript/utils/`.

| Module | Description |
|--------|-------------|
| `doc_cache.js` | In-memory document cache keyed by doc_id; pre-registers IDs from snapshots; fetches missing docs in batches |
| `case_runtime.js` | Case object handling with cache option to skip HTTP calls |
| `configuration_runtime.js` | Client-side feature flags (`communalScorersOnly`, `queryListSortable`) set from server-rendered HTML attributes |
| `curator_vars.js` | Extracts template variables from query params: `#$query##` (query text), `##variableName##` (curator vars) |
| `live_query_*.js` | Query execution, events, diffing and registry for the live case list |
| `api/fetch.js` (`apiFetch`) | HTTP wrapper that adds the CSRF token; replaces the Angular `rails-csrf` interceptor |

Doc lists detect two error conditions (undefined/missing ID field, duplicate IDs) and create stub docs with error messages so the list renders without crashing. The east/main pane split is drag-resizable with no localStorage persistence.

### Key UI Components

**Search & Results:**
- `search_results` / `search_result` - Display search results
- `matches` / `debug_matches` - Match highlighting
- `detailed_doc` / `detailed_explain` - Document detail views
- `doc_finder` - Document search
- `diff` - Result comparison

**Case Management:**
- `new_case` / `clone_case` / `delete_case` / `archive_case` - Case lifecycle
- `case_listing` - Case list display
- `export_case` - Export functionality
- `share_case` - Sharing dialog (Stimulus)

**Scoring:**
- `qgraph` - Query graph visualization
- `qscore_case` / `qscore_query` - Score visualization
- `new_scorer` / `edit_scorer` / `clone_scorer` / `delete_scorer` - Scorer management
- `scorer_listing` - Scorer list

**Team & User:**
- `new_team` / `add_member` / `remove_member` - Team management
- `team_listing` / `user_listing` - List displays
- `share_scorer` - Scorer sharing

**Data Management:**
- `import_ratings` / `import_to_cases` - Import tools
- `judgements` - Judgment modal
- `annotations` / `annotation` - Annotation display

**Visualization:**
- `stacked_chart` - Stacked chart directive
- Vega-Lite rendering for QGraph (`utils/qgraph.js`), the frog report and analytics
- `frog_report` - Froggy mascot reporting
- Media embeds — `search_result_controller.js` detects audio (mp3/wav/ogg), image and video (mp4/webm) URLs by file extension and renders `<audio>`/`<img>`/`<video>` tags

### Build Pipeline

```
esbuild → core_vendor.js (vendor libs, CodeMirror, Bootstrap)
esbuild → core_case.js (core_stimulus.js: case-page controllers and utils)
esbuild → jquery bundle, analytics.js (Vega)
Node.js → application.css, core.css, admin.css (concatenated CSS)
```

**Development (Foreman, `Procfile.dev`):**
```
web:         puma
worker:      bin/jobs (Solid Queue)
core_vendor: npm run build:core-vendor -- --watch=forever
core_case:   npm run build:core-case -- --watch=forever
css:         npm run build:css:watch
```

---

## 19. Bulk Judging Interface

A dedicated full-page interface for rapid document judging, separate from the standard one-at-a-time judgment flow.

### Features

| Feature | Description |
|---------|-------------|
| Card Layout | Query-grouped card layout with documents displayed per query |
| Sticky Query Sidebar | Query text stays visible while scrolling through documents |
| Inline Rating | Radio button groups for each document with color-coded scale buttons |
| Auto-Save | Ratings and explanations auto-save via AJAX (Stimulus controller) |
| Reset Button | Clear individual ratings |
| Query Text Filter | Filter documents by query text |
| Unrated Only | Toggle to show only unrated documents |
| Rank Depth Filter | Filter by document position/rank |
| Show Explanations | Toggle to show/hide explanation text areas |
| Scoring Guidelines | Collapsible section with Markdown-rendered guidelines |
| Document Counter | Badge showing total document count |
| Image Thumbnails | Auto-detected from thumb/image fields in document data |
| Field Display | Humanized field names with link detection (http prefix) |
| Pagination | Bootstrap pagination for large document sets |
| Status Indicators | Visual save state feedback per document |

---

## 20. Proxy & HTTP Layer

### Proxy Controller

| Feature | Description |
|---------|-------------|
| Request Proxying | Routes search requests through Quepid server to avoid CORS issues |
| GET Proxying | Forwards query parameters to external search endpoints |
| POST Proxying | Forwards JSON body to external search endpoints |
| Authentication Passthrough | Forwards basic auth credentials and custom headers |
| Rate Limiting | Respects requests_per_minute configuration on endpoints |

### HTTP Client Service

| Feature | Description |
|---------|-------------|
| Addressable URI | Supports international (non-ASCII) characters in URLs |
| Basic Auth | From credentials parameter or URL userinfo |
| Custom Headers | JSON-configurable per request |
| Timeouts | 30s read, 10s open (configurable) |
| Redirect Following | Automatic redirect handling |
| Shared Client | Used by ProxyController, DownloadPage tool, MapperWizardService |

---

## 21. User Profile & Account Management

### Profile Features

| Feature | Description |
|---------|-------------|
| Avatar | Gravatar-based from email address (small/medium/big sizes) |
| Display Name | Name or email fallback |
| Stats Display | Cases, Teams, Queries, Ratings counts |
| Member Since | Registration date with relative time |
| Profile Editing | Name, email, company name |
| Email Marketing | Opt-in/opt-out toggle (GDPR compliance) |

### Account Security

| Feature | Description |
|---------|-------------|
| Password Change | Requires current password verification |
| Password Reset | Email-based with 6-hour token window |
| Account Deletion | Self-service with cascade deletion warning |

### Personal Access Tokens (API Keys)

| Feature | Description |
|---------|-------------|
| Token Generation | Create new HMAC-SHA256 API tokens |
| Token Display | Shown once at creation (never stored in plain text) |
| cURL Example | Auto-generated example command with token |
| Token Management | List and destroy existing tokens |
| Bearer Auth | Tokens used via HTTP Authorization header |

---

## 22. Background Job Processing

### Job Queue: Solid Queue 1.7.0

| Job | Queue | Purpose |
|-----|-------|---------|
| RunCaseEvaluationJob | bulk_processing (2 concurrent, 12hr) | Full case evaluation against search endpoint |
| PopulateSnapshotJob | default | Decompress and import snapshot data |
| PopulateBookJob | bulk_processing | Sync snapshot query-doc pairs to book |
| ExportBookJob | bulk_processing | Export book as JSON ZIP |
| ImportBookJob | bulk_processing | Import book from JSON ZIP |
| RunJudgeJudyJob | default | AI-powered automated judging |
| UpdateCaseJob | default | Sync judgments to case ratings |
| UpdateCaseRatingsJob | default | Sync ratings for modified query-doc pairs |
| JudgementFromRatingJob | default | Create judgments from ratings |
| TrackBookViewedJob | default | Update book view metadata |
| EnqueueRunNightlyCasesJob | default | Schedule nightly case evaluations |
| WebsocketTesterBackgroundJob | bulk_processing | Test WebSocket connectivity |

---

### Recurring / Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| EnqueueRunNightlyCasesJob | Daily at 1:00 AM | Evaluates all cases flagged with `nightly: true` |
| Blazer.send_failing_checks | Hourly (dev) / Daily 7 AM (prod) | Database health check notifications |

### Queue Configuration

- Dispatcher polling: 1-second interval, 500-batch size
- Worker threads: 3 per process (configurable via JOB_CONCURRENCY)
- Two queues: `default` and `bulk_processing`

---

## 23. API Surface

**Canonical endpoint list:** OpenAPI at `/api/docs` (auto-generated via `oas_rails`). Route source: `config/routes.rb` (`namespace :api`).

**Client patterns:** [`DEVELOPER_GUIDE.md` § Stimulus HTTP conventions](../DEVELOPER_GUIDE.md#stimulus-http-conventions) for current client code.

**HTML (non-API) routes:** [`complete_application_specification.md` §20.5](../complete_application_specification.md#205-html-rails-routes-non-api).

### REST API (v1) — conventions

**API design:**
- Version negotiation via Accept header (`vnd.quepid+json;version=1`), not URL — v1 is the default
- OpenAPI/Swagger documentation auto-generated via `oas_rails` at `/api/docs`
- All API routes scoped under `/api` with `defaults: { format: :json }`
- Conditional route registration: signup route only exists if `SIGNUP_ENABLED` is true at boot

**Authentication:**
- **Session:** Cookie-based for browser (`POST /users/login`, `GET /logout`, `POST /users/signup`)
- **API Key:** `Authorization: ApiKey <token>` or `?api_key=<token>` for automated access

### API Response Shape Variations

Jbuilder views use different rendering depths depending on context:

| Mode | Description | Example |
|------|-------------|---------|
| Shallow | Minimal fields (ID, name) for list views and dropdowns | `cases/index` |
| Deep | Full object with nested associations for detail views | `cases/show` |
| Export | Complete data dump with all associations for import/export | `export/cases/show` |

This pattern is consistent across cases, books, queries, tries, and snapshots — the same model may have 3+ different JSON representations depending on the API endpoint.

---

## 24. Real-Time Features

### WebSocket Channels (ActionCable + Solid Cable)

| Channel | Purpose |
|---------|---------|
| Book Progress | Broadcast populate/export/import progress |
| Case Evaluation | Broadcast evaluation progress |
| Rating Sync | Real-time rating updates |
| Turbo Streams | General UI updates |

### Turbo Stream Broadcasts

Used for:
- Book populate progress (0-100%)
- Book export progress (33%, 66%, 100%)
- AI judging progress (per-pair completion)
- Case evaluation progress (per-query completion)
- Rating sync notifications

---

## 25. Configuration & Feature Flags

### Environment-Based Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| SIGNUP_ENABLED | true | Enable/disable user self-registration |
| EMAIL_LOGIN_ENABLED | true | Enable/disable email+password authentication |
| COMMUNAL_SCORERS_ONLY | false | Restrict users to admin-approved communal scorers only |
| QUERY_LIST_SORTABLE | true | Enable/disable drag-and-drop query reordering |
| SEARCH_ENDPOINT_VIEWS_ADMIN_ONLY | false | Restrict search endpoint management to admins |
| FORCE_SSL | false | Force HTTPS redirects |
| ASSUME_SSL | false | Trust SSL termination from reverse proxy |
| EMAIL_MARKETING_MODE | false | Show GDPR-compliant marketing opt-in |
| QUEPID_DEFAULT_SCORER | AP@10 | Default scorer assigned to new users |
| REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS | false | Require `proxy_requests` for endpoints with basic-auth credentials and hide those credentials from API responses |
| OPENID_CONNECT_BASE_URL / _CLIENT_ID / _CLIENT_SECRET / _ISSUER / _BUTTON_TEXT | empty (button text: "Sign in with OpenID Connect") | Generic OpenID Connect login; the first four are all required |
| OLLAMA_SERVICE_URL | `http://ollama:11434` (production), `http://ollama:31434` (other environments) | Ollama endpoint for local LLM features |
| QUEPID_CONSIDER_ALL_REQUESTS_LOCAL | unset | When set (any value), production shows full error reports (`consider_all_requests_local`) |

### Legal & Compliance

| Setting | Purpose |
|---------|---------|
| TC_URL | Terms & Conditions URL (enables acceptance checkbox on signup) |
| PRIVACY_URL | Privacy policy URL |
| COOKIES_URL | Cookies policy URL (dedicated /cookies page with browser-specific guides) |

### API Versioning

- Accept header-based: `vnd.quepid+json;version=1`
- Implemented via `ApiConstraint` routing constraint
- OpenAPI documentation auto-generated via OasRails (mounted at `/api/docs`)

### CORS Configuration

- Wildcard origin support (`*`)
- All HTTP methods allowed
- All headers allowed
- Credentials: false (token-based auth)

### Email Configuration

| Provider | Details |
|----------|---------|
| SMTP | Traditional SMTP with full host/port/credentials config |
| Postmark | SaaS delivery via API token |
| Development | Letter Opener gem for email preview in browser |

---

## 26. Infrastructure & Deployment

### Docker Support

| File | Purpose |
|------|---------|
| `Dockerfile.dev` | Development image (`ruby:4.0.6-trixie`) |
| `Dockerfile.prod` | Production multi-stage build (`ruby:4.0.6-slim-trixie`) |
| `docker-compose.yml` | Full dev stack (app, MySQL 8.4.3, Keycloak, Ollama, Nginx) |
| `docker-compose.prod.yml` | Production variant |
| `docker-compose.override.yml.example` | Local overrides |

### Mounted Rails Engines

| Engine | Path | Purpose |
|--------|------|---------|
| ActionCable | `/cable` | WebSocket connections |
| ActiveStorageDB | `/active_storage_db` | Database-backed file storage |
| OasRails | `/api/docs` | OpenAPI/Swagger documentation UI |
| MissionControl::Jobs | `/admin/jobs` | Solid Queue job dashboard (admin-only) |
| Blazer | `/admin/blazer` | SQL analytics dashboard (admin-only) |

### Production Build Features

- Multi-stage Docker build (base → build → final)
- Node.js 24.18.1 for asset compilation (`Dockerfile.prod` `NODE_VERSION`)
- jemalloc for memory optimization
- Propshaft asset precompilation
- Puma web server via Foreman
- Port 3000 exposed
- Optional in-process Solid Queue via `SOLID_QUEUE_IN_PUMA` env var

### Deployment Platforms

| Platform | Configuration |
|----------|--------------|
| Docker | Dockerfile.prod + docker-compose |
| Heroku | app.json (JawsDB MySQL, LogDNA); two buildpacks (nodejs + ruby); standard-2x dynos |
| Local | bin/setup scripts (idempotent: bundle, yarn, db:prepare, sample data, bin/dev) |
| Sub-path | `RAILS_RELATIVE_URL_ROOT` support for deployment under a path (e.g., `tools.bigcorp.com/quepid`); docker-entrypoint recompiles assets when set |
| AWS EC2 | CloudFormation template: VPC + EC2 instance running docker-compose |
| AWS Fargate | CloudFormation template: ECS Fargate with MySQL RDS |
| Docker Deploy | Standalone docker-compose with MySQL 8, Quepid, and Ollama (for AI judges) |

### Thor CLI Tasks

| Task File | Commands | Purpose |
|-----------|----------|---------|
| `user.thor` | `user:create`, `user:reset_password`, `user:grant_administrator`, `user:add_api_key` | User management from CLI |
| `case.thor` | `case:create`, `case:share`, `case:load_the_haystack_rating_snapshots` | Case creation and data loading |
| `ratings.thor` | `ratings:import`, `ratings:generate` | Import ratings from file or generate from Solr |
| `snapshots.thor` | `snapshots:import`, `snapshots:generate` | Import/generate snapshot data |
| `sample_data.thor` | `sample_data`, `large_data`, `haystack_party` | Demo data, large-scale test data (100s/1000s of queries), Haystack Conference data |

### Rake Tasks

| Task | Purpose |
|------|---------|
| `assets:jupyterlite` | Downloads JupyterLite build from GitHub releases, unpacks to `public/notebooks/`; hooked into `assets:precompile` for production |
| `db:exists` | Checks DB connectivity (exit 0/1); used for Docker health checks |
| `test:report_failed_tests` | Parses JUnit XML reports for CI failure reporting |
| `erd:image` | Generates entity-relationship diagram PNG to `docs/erd.png` |

### Environment Configuration

- `.env` files (dotenv gem)
- Feature flags via env vars
- ActiveRecord encryption keys
- OAuth provider configs
- Email provider (Postmark)
- Solid Cable polling interval

---

## 27. Testing Infrastructure

### Backend Tests (Minitest)

| Category | File Count |
|----------|-----------|
| Controller Tests | 60 |
| Model Tests | 20 |
| Integration Tests | 12 |
| Service Tests | 14 |
| Job Tests | 7 |
| Helper Tests | 5 |
| Library Tests | 3 |
| Tool Tests | 2 |
| System Tests | 1 |
| **Total** | **136 files, ~18,749 lines** |

### Frontend Tests

| Tool | Scope |
|------|-------|
| Vitest (`yarn test:unit`) | ~138 spec files under `test/javascript/` covering controllers, modules, utils and API helpers |
| Playwright (`yarn test:e2e`) | 24 end-to-end specs with screenshot baselines and axe accessibility checks |
| Stryker (`yarn test:mutation`) | Mutation testing on the Vitest suite |

### Test Infrastructure

- **Fixtures**: 22 YAML fixture files
- **WebMock**: Extensive HTTP mock responses (27KB)
- **SimpleCov**: Code coverage reporting
- **Minitest Reporters**: Progress + JUnit XML output
- **Bullet**: N+1 query detection in tests

### CI/CD

| System | Purpose |
|--------|---------|
| GitHub Actions | Test workflow (`test.yml`, runs `rails test` in Docker on push) + nightly builds |
| Dependabot | Dependency updates |

### Code Quality

| Tool | Purpose |
|------|---------|
| RuboCop | Ruby linting (with Rails, Minitest, Capybara plugins) |
| ESLint + Prettier | JavaScript linting and formatting |
| Stylelint | CSS linting |
| DatabaseConsistency | Schema validation |
| DeepSource | Static analysis |
| Bullet | N+1 query detection |
| AnnotateRb | Model annotation |

---

## 28. Splainer-Search Integration

Quepid integrates the `splainer-search` library (an OpenSource Connections library) for client-side search engine interaction.

### Features

| Feature | Description |
|---------|-------------|
| Multi-Engine Searchers | Creates searcher instances for Solr, ES, OpenSearch, Vectara, Algolia, SearchAPI |
| Explain Parsing | Parses search engine explain/debug output for relevance score breakdown |
| Field Specification | Configures which document fields to extract and display |
| Document Normalization | Normalizes documents from different engines into a common format |
| Query Template Variables | Supports `#$query##` variable substitution in query templates |
| Snapshot Searcher | Implements the same interface for pre-saved snapshot data |
| Client-Side Execution | Searches run in the browser (except when proxy_requests is enabled) |

---

## 29. Onboarding & Tours

### Interactive Tour (Shepherd.js)

| Feature | Description |
|---------|-------------|
| Case Header Tour | Introduces the case header and navigation |
| Score Explanation | Explains how case scores work |
| Add Query Walkthrough | Guides user through adding their first query |
| Queries Section | Introduces the query list and management |
| Case Actions | Tour of available case actions |
| Tune Relevance | Walkthrough of the relevance tuning workflow |
| Rerun Searches | Demonstrates how to re-execute searches |
| Knowledge Base Links | Links to tutorials and documentation |

### New User Experience

| Feature | Description |
|---------|-------------|
| Case Wizard | `completed_case_wizard` flag tracks first-case creation; `?showWizard=true` URL param forces wizard open for any user |
| Welcome Message | Displayed on home page for users with no cases |
| Default Scorer | Automatically assigned on user creation |
| Mixed-Content Warnings | Alerts when HTTPS page tries to access HTTP search engine |
| Static CSV Upload | Wizard supports CSV upload for "Static" search engines (headers: `Query Text`, `Doc ID`, `Doc Position`); creates a snapshot and serves it as a fake Solr endpoint |
| Wizard TLS Redirect | On protocol mismatch, offers a matching-protocol reload and carries the current wizard handoff parameters in the URL; credential exposure in this legacy handoff is tracked as a pre-existing todo |
| Standalone Mapper Wizard | SearchAPI mapper setup is available from Search Endpoints at `/search_endpoints/mapper_wizard`; the compact case wizard does not include an inline shortcut |
| First-Time Tour Trigger | After wizard close, auto-triggers Shepherd.js guided tour with 1.5s delay if `completedCaseWizard` is still false |

---

## 30. Analytics Visualizations

### Home Page

| Visualization | Technology | Purpose |
|---------------|-----------|---------|
| Sparklines | Vega-Lite | Mini score trend charts per case |
| Score Trend | Vega-Lite | Interactive line chart with score changes over time |
| Change Points | Prophet (prophet-rb) | Automatic detection of significant score changes |
| Consensus Toast | Turbo Frame | Notification of score agreement/disagreement |

### Analytics Pages

| Visualization | Technology | Purpose |
|---------------|-----------|---------|
| Tries Tree | Vega (canvas) | Interactive tree visualization of try ancestry/branching |
| Duplicate Scores | Table + D3 | Analysis of duplicate score entries per try/day |
| Judgement Leaderboard | Vega-Lite bar chart | Judges vs judgement counts per book |
| Admin Calendar Heatmap | Cal-heatmap + D3 | User activity heatmap on admin dashboard |

### In-App Visualizations

| Visualization | Technology | Purpose |
|---------------|-----------|---------|
| QGraph | Vega-Lite (`utils/qgraph.js`) | Query-level score graph |
| QScore | `qscore-query` / `qscore-case` Stimulus controllers | Per-query and per-case score badges |
| Stacked Chart | `match-explain` Stimulus controller | Match-explain stacked chart popover on search results |
| Frog Report | Custom | Froggy mascot score reporting |

---

## 31. PWA & Accessibility

### Progressive Web App

| Feature | Status | Details |
|---------|--------|---------|
| Manifest | Present | App name, icons (512x512), standalone display mode, theme color |
| Service Worker | Stub | Push notification handler present but commented out |
| Installable | Partial | Manifest present, service worker minimal |

### Accessibility

| Feature | Details |
|---------|---------|
| Bootstrap ARIA | Standard Bootstrap accessibility attributes |
| Keyboard Navigation | Keyboard shortcuts for rating (A-L keys) |
| Color-Coded Ratings | Visual scale with distinct HSL colors per rating value (red→yellow→green gradient) |
| Responsive Layout | Bootstrap grid-based responsive design |

### Additional UI Features

| Feature | Details |
|---------|---------|
| GDPR Consent Toast | Cookie consent banner (Bootstrap toast, auto-dismisses after 15s); only shown when `COOKIES_URL` is configured |
| Cookie Policy Page | `/pages/cookies` serves a boilerplate cookie policy; `PagesController` dynamically renders any template in `app/views/pages/` |
| Custom Error Pages | Styled 400, 404, 422, 500 HTML pages; plus a custom `406-unsupported-browser.html` with inline Quepid "406" SVG branding |
| Open Graph / Twitter Cards | Dynamic meta tags for case URLs enabling rich link previews when shared |
| Apple Web App | `apple-mobile-web-app-capable` meta tags for iOS home screen installation |
| Markdown Rendering | Redcarpet gem with GitHub-flavored markdown: tables, fenced code, strikethrough, superscript, underline, highlight, autolinks |
| Local Time Display | `local_time` gem/JS converts UTC timestamps to browser-local time |
| Kraken Celebration | Animated overlay with CSS fade-out when AI judging completes ("Unleash the Kraken!!") |
| Sidebar Suppression | Sidebar hidden during judgement workflow (`new`/`edit` actions) to reduce distraction |

---

## 32. Jupyterlite Notebooks

### Overview

Quepid embeds a full **Jupyterlite** (browser-based Jupyter) environment served as static files from `public/notebooks/`. The notebooks are built in a separate repository (`o19s/quepid-jupyterlite`) and downloaded as a release tarball during setup.

### Setup & Deployment

| Aspect | Details |
|--------|---------|
| Source Repository | `https://github.com/o19s/quepid-jupyterlite` |
| Installation | `bin/setup_jupyterlite` extracts tarball into `public/notebooks/` |
| Production | Baked into Docker image at build time |
| Access Path | `/notebooks/lab/index.html` (served as static files, no Rails route) |

### UI Integration

The notebooks are linked from three navigation points:
- Core case page header (`_header_core_app.html.erb`)
- Modern layout header (`_header.html.erb`)
- Sidebar navigation (`_sidebar.html.erb`)

All links open in a new tab (`target: '_blank'`).

### Haystack Party Notebooks

Two specific snapshots (IDs 2471, 2473 for case 6789) are **permanently preserved** from snapshot cleanup because they are used in sample Jupyterlite notebooks. This is hardcoded in `FetchService::SPECIAL_SNAPSHOTS_TO_PRESERVE`.

---

## 33. Frog Report (Rating Analysis Dashboard)

### Overview

The Frog Report is a **client-side rating coverage analysis tool** that shows how many query/document pairs are missing ratings. It runs entirely client-side (`frog_report_controller.js`) — no Rails backend controller or job is involved.

### Metrics Computed

| Metric | Description |
|--------|-------------|
| Total Ratings Needed | Sum of all documents across all queries |
| Number of Ratings | Count of documents that have been rated |
| Missing Ratings | Sum of `countMissingRatings` across all queries |
| Missing Ratings Rate | `(missing / total) * 100`, rounded to 1 decimal |
| Depth of Rating | Maximum `depthOfRating` across all queries |
| Distribution Histogram | Queries bucketed by missing-rating count ("Fully Rated", "Missing N", "No Ratings") |

### Visualization

Renders a **Vega bar chart** showing the distribution of queries by how many ratings they're missing. The recommended target is displayed as a message:

> "We recommend maintaining less than a 5% missing ratings to have confidence in the scores you are calculating."

### Book Refresh Integration

If the case has a linked book (`bookName`), the modal footer shows a **"Refresh ratings from book"** button. For cases with 50+ queries, the refresh runs as a background job and redirects to the home page.

### Components

| File | Role |
|------|------|
| `frog_report.html` | Button template (frog emoji + "Report" link) |
| `frog_report_controller.js` | Opens modal via `$uibModal` |
| `frog_report_modal_instance_controller.js` | Stats computation engine |
| `_modal.html` | Modal template with Vega chart |
| `froggy.css` | Styles including Querqy icon |

---

## 34. Health Check & Operational Endpoints

### Health Check

| Aspect | Details |
|--------|---------|
| Path | `GET /healthcheck` |
| Handler | `rails/health#show` (built-in Rails 8 health check) |
| Success Response | HTTP 200 |
| Failure Response | HTTP 500 |
| Checks | Active Record connectivity, cache, and other configured Rails subsystems |

---

## 35. Key Architectural Decisions

### No Result Storage

Quepid **does not store search result documents**. It only stores `doc_id` values and their associated ratings. Every time a user views search results, the queries are re-executed live against the search endpoint. This means:
- No stale result caching issues
- Minimal database storage requirements
- Results always reflect the current state of the search index
- Snapshots are the exception — they capture point-in-time result lists

### Case-to-Book-to-Case Workflow

Cases (live search evaluation) and Books (offline judgment collection) are connected in a bidirectional workflow:
1. **Case → Book**: Populate a Book from a Case's queries and top-N results
2. **Book**: Collect human/AI judgments on query-document pairs
3. **Book → Case**: Refresh a Case's ratings from a Book's averaged judgments

### Try Ancestry Overflow Handling

The `ancestry` column for Tries is `string(3072)`. When creating a new try would cause the ancestry path to exceed this limit, the controller catches `ActiveRecord::ValueTooLong` and **restarts the chain** by setting `parent = nil`. Orphaned tries use the `:adopt` strategy (adopted by grandparent).

### Three-Judgement Cap

The selection strategy uses a **3-judgement cap per query-document pair**. Once a pair has 3 judgements, it is no longer selected for further human evaluation. This balances coverage with inter-rater reliability.

### Smart Rating Averaging

When refreshing case ratings from book judgments, the system averages all judgements for each query-document pair and rounds to the nearest integer, since case ratings are discrete values.

### Provider-Agnostic AI Judge

The AI Judge system calls `POST /v1/chat/completions` against a **configurable URL** — any OpenAI-compatible API works. The authorization header is only sent when a key is present, enabling keyless local providers like Ollama. No provider enum or switch exists; the architecture is fully URL-driven.

### AI Judge as Soft STI on User

AI judges are `User` records with a non-nil `llm_key`. There is no proper STI — `ai_judge?` checks `llm_key.present?`. Validations are conditional: email/password required for humans, name/llm_key/system_prompt required for AI judges. The code has an explicit TODO: "Let's get STI in and have actual AiJudge and User objects!"

### `really_destroy` Pattern

Both `Case` and `Book` define a `really_destroy` method for manual destruction order, because Rails' `dependent:` options cannot handle their complex FK dependency graphs cleanly. Case destroys snapshots → unscoped queries → tries → self. Book deletes judgements via JOIN → delete_all query_doc_pairs → destroy self.

### HABTM Relationships ("Too Late Now")

All team relationships use `has_and_belongs_to_many` (6 join tables) with an acknowledged code comment: "too late now!" — the team decided not to migrate to `has_many :through` with proper join models.

### Database-Backed Everything (No Redis)

The architecture explicitly avoids Redis: Solid Queue (jobs), Solid Cable (WebSockets/ActionCable), and ActiveStorageDB (file storage) all use the MySQL database. This simplifies deployment to a single-database architecture.

### Scale Immutability

Book scales cannot be changed once any judgement exists — this is a data integrity guard, since existing judgement ratings would become invalid. Labels can still be updated independently.

### Documentation Suite

The [`docs/`](../README.md) directory is indexed in [`README.md`](../README.md). Key cross-references:
- [`complete_application_specification.md`](../complete_application_specification.md) — canonical schema columns, HTML routes, and business rules (feature behavior lives in this file and COREUI)
- [`QUEPID_FEATURES.md`](./QUEPID_FEATURES.md) / [`QUEPID_COREUI_FEATURES.md`](./QUEPID_COREUI_FEATURES.md) — app-wide and case-workspace feature inventories
- [`todo.md`](./todo.md#frontend-cleanup-after-angular-removal) — frontend cleanup after Angular removal
- [`todo/todo.md`](./todo/todo.md) — open bugs and hardening
- [`data_mapping.md`](./data_mapping.md) / [`app_structure.md`](./app_structure.md) — canonical data model and architecture explanations
- [`operating_documentation.md`](./operating_documentation.md) — operations/deployment guide covering Nginx, OAuth, Thor scripts, etc.
- [`endpoints_solr.md`](./endpoints_solr.md) / [`endpoints_opensearch.md`](./endpoints_opensearch.md) — detailed per-engine query documentation
- [`ENCRYPTION_SETUP.md`](./ENCRYPTION_SETUP.md), [`jupyterlite.md`](./jupyterlite.md), [`agentic_javascript_extraction.md`](./agentic_javascript_extraction.md) — feature-specific docs
- [`erd.png`](./erd.png) — entity-relationship diagram (generated via `rake erd:image`)
- `Quepid-Data-Storage-Briefing.pdf` — stakeholder briefing document

---

## Summary Statistics

Counts drift as the tree changes — re-count before citing exact numbers.

| Metric | Count (Sep 2026) |
|--------|------------------|
| Database Tables | 53 |
| Database Migrations | 187 |
| Models (`app/models/*.rb`) | 27 |
| Controllers (total) | 95 (47 under `app/controllers/api`) |
| API Endpoints | 80+ (canonical list: OpenAPI `/api/docs`) |
| Services (`app/services`) | 13 |
| Background Jobs (`app/jobs`) | 13 (plus recurring scheduled) |
| RubyLLM Tools | 3 |
| Validators | 4 |
| Routing Constraints | 2 |
| View Helpers | 9 |
| Analytics Trackers | 9 |
| Stimulus Controllers | 70 |
| Vitest spec files (`test/javascript`) | ~138 |
| Test Files (Ruby, `*_test.rb`) | 156 |
| Supported Search Engines | 7 (`splainer-search` 3.3.0) |
| Feature Flags / env settings (§25 table) | 13 |
| Gem Dependencies | 70+ |
