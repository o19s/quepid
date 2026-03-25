# Rails-Stimulus Migration Plan

Replacing the AngularJS core UI with Rails views, Turbo, and Stimulus—using the stack Quepid already uses everywhere else.

**Status:** The **case / try workspace** on `GET /case/:id(/try/:try_number)` is now the **Stimulus** shell (`CoreController#index`, `layouts/core.html.erb`, `app/views/core/`). The detailed feature breakdown, artifact tables, and Angular→Stimulus mapping that lived in earlier versions of this doc described work that is **largely shipped** or superseded.

**Code locations:** Stimulus controllers under `app/javascript/controllers/` (see `index.js` for registration); shared helpers under `app/javascript/modules/`.

---

## Guiding Principles

1. **Incremental migration** — Angular and Stimulus core coexisted during migration; the case workspace has now cut over. Other surfaces may still follow the same strangler pattern.
2. **API stays the same** — The Rails JSON API (browser paths like `api/cases/...`) remains stable. Stimulus calls the same endpoints the legacy UI used.
3. **Rails remains the host** — No client-side router for the core. Rails routes; **Turbo Drive** where enabled (globally off in `application_modern` today); **Turbo Frames/Streams** or **`fetch`** for partial updates. Rails handles auth, CSRF, and serves the page.
4. **No feature regression** — Migrated pieces matched existing functionality before Angular removal; ongoing gaps are tracked in [new_ui_capabilities.md](./new_ui_capabilities.md) and [workspace_behavior.md](./workspace_behavior.md).
5. **Prefer the stack you already have** — The core is ERB + Stimulus + Turbo like the rest of Quepid.

---

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Stimulus 3 + Turbo 8 | Already in use app-wide; no new paradigm |
| Routing | Rails routes + Turbo Drive | Single source of truth; deep links and back/forward work naturally |
| Partial updates | Turbo Frames (+ Streams) | In-place frame replacement; optional WebSocket streams for live updates |
| State | Server + DOM + minimal Stimulus values | Server-rendered HTML and frame content; transient UI state in controllers |
| HTTP client | fetch (native) | Use `apiUrl()` + `csrfToken()` from `modules/api_url` for Rails JSON |
| Build | esbuild (existing) | Same Stimulus/JS bundle as rest of app; no JSX, no React |
| CSS | Existing CSS + Bootstrap 5 | No change |
| Charts | D3 (existing) | Already bundled; use from Stimulus controllers |
| Modals | Bootstrap 5 modals + Stimulus | Match existing app patterns |
| Testing | System tests (Capybara) + Vitest for Stimulus | New/changed Stimulus controllers get `test/javascript/controllers/<name>_controller.test.js`; `bin/docker r yarn test` runs Karma + Vitest |
| Heavy deps | splainer-search, ScorerFactory | Framework-agnostic; wrapped for use by Stimulus where needed |

---

## Rails Integration Approach

### Layout

The core workspace uses **`layouts/core.html.erb`** with the modern importmap entry (`application_modern.js`: Stimulus + Turbo). Bootstrap data (current user, configuration, CSRF token) is passed via meta tags or data attributes.

### Routes

Rails routes remain the single source of truth. Full-page navigations use normal loads or Turbo visits where Drive is enabled. In-place updates use Turbo Frames and/or `fetch` + DOM updates. Optional dedicated actions can return frame-only HTML for clearer boundaries—see [turbo_frame_boundaries.md](./turbo_frame_boundaries.md).

### Controller and View Structure

**`Case::CoreController`** (and related actions) render the core shell and compose partials under `app/views/core/`. Stimulus controllers attach via `data-controller` on the shell and inside any frames.