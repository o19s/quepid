# Wizard: auto-enable proxy for basic auth (extracted ideas)

Curated from stash `docs/other-stashes/02-wizard-ensure-proxy-for-basic-auth/` (source: `fix/wizard-finish-save`). The full AngularJS/HTML/jbuilder snapshots were deleted — only shippable ideas remain. Re-implement on current main; do not resurrect the stash files.

## Already shipped (do not redo)

- Finish-step save errors: `finishSaveError` / `formatFinishSaveError` in `wizardModal.js` + alert in `wizardModal.html`.
- Backend reject when basic auth is set without proxy and `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is true: `SearchEndpoint#validate_proxy_required_for_hidden_credentials`.
- Config default is still `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS=false` (`.env.example`) — many local/dev envs never hit the hard fail.

## Still worth shipping

### 1. Auto-enable proxy when basic auth is present (primary)

**Problem:** User can type `username:password` in the create-case wizard Advanced pane while leaving **Proxy Requests** unchecked. When require-proxy is on, Finish fails validation. Even when require-proxy is off, browser-side requests with basic auth are fragile (Chrome/CORS).

**Idea:** When `basicAuthCredential` is non-blank after trim, set `proxyRequests = true`.

**Where (current main):**

- `app/assets/javascripts/controllers/wizardModal.js` — add something like `ensureProxyForBasicAuth(settings)` and call it from:
  - settings defaults / search-engine change / existing-endpoint change (after copying `basicAuthCredential` / `proxyRequests`)
  - basic-auth input `ng-change` (today only `resetUrlValid()`)
- `app/assets/templates/views/wizardModal.html` — wire that change handler on the basic-auth field; optional one-line Advanced hint (“Required when basic auth credentials are set”).

Keep it tiny (~15 lines). Do not port the old stash controller wholesale (BS5 / `$quepidModal` / `showProxyHelpIfNeeded` already diverge).

### 2. OpenSearch demo defaults: proxy on

**Problem:** OS defaults in `settingsSvc.js` use `basicAuthCredential: 'reader:reader'` with `proxyRequests: false` (both `defaultSettings.os` and `tmdbSettings.os`). With require-proxy enabled, finishing a wizard on the OS demo fails.

**Idea:** Set `proxyRequests: true` for those OS demo blocks (matching the stash intent).

### 3. Team shared-endpoint credential advisory (optional / later)

**Problem:** User types basic auth while binding a **team-shared** search endpoint they do not own. Creds are not applied to that shared record; Finish can succeed without the user realizing.

**Idea (stash only):** After save, if typed creds + bound endpoint `owner_id` ≠ current user, show a Finish-step info alert with a link to edit the endpoint instead of auto-closing. Required API bit: expose `owner_id` on the search-endpoint JSON (`_search_endpoint.json.jbuilder`).

**Defer** unless product asks — separate from the proxy auto-enable fix.

## Out of scope / discard

- Full file copies of `wizardModal.js`, `wizardModal.html`, `settingsSvc.js`, `_search_endpoint.json.jbuilder` from the stash.
- Re-implementing Finish save-error UX (already on main under different names).
