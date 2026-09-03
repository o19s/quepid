---
name: angular-case-migration
description: >-
  Phased playbook for removing AngularJS from the core case UI while preserving
  per-surface UX. Use when porting Angular components on /case/:id or when a
  feature exists on both core (Angular) and Rails pages (Stimulus twins). Enforces
  surface-specific equivalence — do not collapse Angular and Rails behaviors into
  one partial.
---

# Angular case-page migration

Quepid's **core case UI** (`/case/:id`) was AngularJS. **Rails pages** (cases index, teams, …) already use Stimulus + ERB. Removing Angular is **not** "make everything look like Angular" or "reuse one Rails partial everywhere."

**Goal:** On each surface, ship **equivalent** functionality and appearance using Stimulus, vanilla JS, and Rails as appropriate.

- **Core toolbar / case workspace:** match what **Angular** shipped (recover `components/<name>/` templates).
- **Rails pages that already had a twin:** match what **that Rails partial + controller** shipped (`git show HEAD:`).
- **Reuse is OK on core** when a Rails/Stimulus building block produces the **same** UX as Angular (e.g. shared modal shell + `share-case-core` API stay-on-page paths) — not when it silently ships cases-index `<select>` on the case page.

**Never collapse** unlike surfaces into one template or one interaction model without an explicit product decision and per-surface screenshot proof.

**Canonical docs:** `docs/todo/angularjs_removal_inventory.md` (category playbooks + PR order), `docs/todo/event_bus_inventory.md` (before deleting `$broadcast` emitters), `CLAUDE.md` / `DEVELOPER_GUIDE.md` (Docker, Vitest, Playwright screenshots).

## Per-surface equivalence (do not collapse)

Quepid had **different share-case (and similar) UX on different surfaces** before migration. Removing Angular means **equivalent functionality and appearance on each surface**, using Stimulus/vanilla/Rails as appropriate — **not** picking one surface's UX and applying it everywhere.

### Identify the surface first

| Surface | Layout | Pre-migration share-case (example) |
|---------|--------|-------------------------------------|
| **Core case** `/case/:id` toolbar | `core.html.erb` | Angular `$quepidModal` template (`list-group`, conditional sections, one footer action) |
| **Rails pages** cases index, teams | `application` | Rails `_share_case_modal` + Stimulus (`<select>`, form POST, redirect) |

Other features may have the same split: **core Angular** vs **Rails Stimulus twin**. Inventory both; never assume one partial is the source of truth for all surfaces.

### Rules

1. **Recover what that surface actually shipped** — Angular template/controller on core; `git show HEAD:` for Rails partial/controller on index/teams.
2. **Parity table per surface** — behavior + appearance + transport (API stay-on-page vs form POST redirect).
3. **Reuse Rails/Stimulus on core is fine** when the result **matches Angular** on that surface (same interaction, labels, visibility). Reusing a **cases-index partial** on core without matching Angular is not.
4. **Do not collapse** — one ERB partial with one interaction model for every surface. Use separate controllers/partials (e.g. `share-case` vs `share-case-core`) or explicit controller branches when surfaces differed.
5. **Do not replace Rails page behavior with Angular behavior** — cases index / teams should stay equivalent to their pre-migration Rails UX unless the user explicitly requests a unified redesign.

### Definition of done (per surface)

- [ ] Parity table for **this surface** (not "closest twin")
- [ ] Tests for this surface's contracts
- [ ] Matched before/after screenshots for **this surface's** prior UX
- [ ] Other surfaces unchanged or explicitly listed in the PR

### Anti-patterns

- **share-case:** One `_share_case_modal` with Angular list UI on cases index (drops `<select>` and always-visible disabled footers users had there).
- **share-case:** Porting API to core but shipping cases-index dropdown UX on the case toolbar.
- **Either direction:** "Unified modal" without a product decision and per-surface screenshot proof.

## Choose the work class

| Class | Examples | Start with |
|-------|----------|------------|
| **Management modals** | share, clone, export, delete/archive, judgements shell | [Management modals](#management-modals) |
| **Heavy widgets** | diff, import-ratings, frog-report, wizard | [Heavy widgets](#heavy-widgets) |
| **Live query state** | `queriesSvc`, search results, rating UI, scoring | [Live query state](#live-query-state) — do not start casually |
| **App-level seams** | scorers, splainer-search, TLS/JSONP, mapper code | Port with UI that needs them; see inventory |

Prefer **Rails view + route + Stimulus** for management actions. Prefer **esbuild bundle** (not importmap) for a heavy case workspace. Do **not** embed new Stimulus inside the Angular bundle as the long-term home.

## Shared phases (all classes)

Copy and track:

```
Migration progress:
- [ ] 1. Inventory the seam
- [ ] 2. Recover Angular truth + parity table
- [ ] 3. Karma baseline (before deleting Angular specs)
- [ ] 4. Implement behind a clear seam
- [ ] 5. Vitest / E2E contracts
- [ ] 6. Matched before/after screenshots
- [ ] 7. Delete Angular + update inventory
```

### 1. Inventory the seam

List before editing:

- Angular component/directive + templates under `app/assets/javascripts/components/` or `app/assets/templates/`
- Controllers / services / factories used
- `$broadcast` / `$on` / `$rootScope` events (`docs/todo/event_bus_inventory.md`)
- Karma specs under `spec/javascripts/angular/`
- Existing Stimulus twin on Rails pages (if any) — record as **that surface's** baseline, not core's source of truth
- Playwright coverage (`test/playwright/`, `.playwright-mcp/<topic>/`)

### 2. Recover surface truth (two baselines when both exist)

1. **Core:** read Angular template + controller (deleted: `git show <commit>:path`).
2. **Rails pages:** read HEAD `_share_case_modal.html.erb` (or equivalent) + HEAD `share_case_controller.js` on index/teams.
3. Fill a **parity table per surface**:

| Concern | Core (Angular) | Rails pages (if applicable) |
|---------|----------------|-----------------------------|
| Interaction model | e.g. list-group | e.g. `<select>` |
| Empty / hidden UI | `ng-if` / `ng-show` | always-visible sections? |
| Footer actions | when visible; labels | disabled until select? |
| Transport | API, stay on page | form POST, redirect |
| Events | `$broadcast` → CustomEvent | usually none |

4. If surfaces differ, plan **separate controllers/partials** (e.g. `share-case` vs `share-case-core`) — split **UI** too when appearance differs.

### 3. Karma baseline first

- Run or capture the relevant Karma examples **before** deleting Angular sources.
- Port contracts to Vitest (`app/javascript/**/*.test.js`) with comments naming the Karma examples.
- Explicitly document dropped examples (e.g. "modal dismiss is Bootstrap `data-bs-dismiss`").
- Keep Karma for services still used by remaining Angular (`teamSvc`, `caseSvc` bridges, etc.).

### 4. Implement behind a seam (per surface)

- **Core:** `core_stimulus.js` + modal/API stay-on-page; UI must match Angular; bridge `caseSvc` with `document` CustomEvents when Angular SPA remains.
- **Rails pages:** keep form POST + redirect; UI must match prior Rails partial; button JSON on `data-*` attributes as before.
- **Do not** change Rails page UX to match core unless explicitly requested.
- Server owns URLs (`data-*-url-value`); `apiFetch` for core JSON mutations.

### 5. Tests

- Vitest for new/changed Stimulus controllers and `api/` / `utils/` logic.
- Playwright: migration pairs under `.playwright-mcp/<topic>/` (`*-before` / `*-after`); for durable golden paths update `test/playwright/baselines/` when Angular is gone.
- Rebuild: `bin/docker r yarn build` / `build:angular-*` / `build:css` as needed. App via Docker (`bin/docker s`); do not stop the dev server unless asked.

### 6. Screenshots (matched states, per surface)

- Core pairs: Angular before vs Stimulus after on `/case/:id`.
- Rails pairs (if touched): HEAD Rails before vs after on cases index / teams — **not** the same PNGs as core.
- Same data state **and** interaction on each pair.

### 7. Delete Angular + inventory

Only when parity table, tests, and matched shots are done:

- Remove component registration and templates; rebuild Angular bundles.
- Update `docs/todo/angularjs_removal_inventory.md` with Done notes and any remaining bridges.
- Do not mark Done for API-only ports.

## Management modals

**Examples:** share-case, clone-case, export-case, delete/archive, judgements entry shell.

**share-case had two live UIs before migration:**

| Surface | Old UX | Old transport |
|---------|--------|---------------|
| Core toolbar | Angular list-group, conditional sections, one footer action | `teamSvc` API, stay on page |
| Cases index / teams | `<select>`, always "Already shared with", two disabled footer buttons | form POST, redirect |

**Forbidden:**

- One `_share_case_modal` that applies Angular list UI on cases index (drops Rails behavior).
- Putting cases-index `<select>` on core toolbar (drops Angular behavior).
- "Unified modal" without separate parity tables and screenshots for each surface.

**Allowed:**

- Separate Stimulus controllers/partials per surface (e.g. `share-case` + `share-case-core`), or one controller with **clear branches** when markup is shared.
- Core reuses ERB modal **only** if markup/behavior matches Angular; Rails pages keep HEAD-equivalent markup.

**Worked mistake:** collapsing both surfaces into one list-group partial — correct for core, wrong for index/teams.

## Heavy widgets

**Examples:** diff, import-ratings, export with job polling, frog-report, new-case wizard.

**Extra inventory:** background jobs, ActionCable/progress, multi-step wizards, ACE/CodeMirror, CSV parsers.

**Seam:** often a dedicated esbuild entry or large Stimulus controller; poll/Cable for jobs; do not block the case page on full rewrite of `queriesSvc`.

**Tests:** step-by-step Playwright shots (each wizard step / diff mode); Vitest for pure parsers and API helpers.

## Live query state

**Examples:** `queriesCtrl` / `queriesSvc`, `searchResults`, rating controls, case score badges, live `scoreAll()`.

**Do not start** without an explicit state plan from the user / inventory fork. This is the god-object path.

**Hard constraints (from inventory):**

- Live search stays **browser → customer engine** (proxy when needed); batch eval is already server-side.
- Rating must still feel instant: client `scoreAll()` on rating is non-negotiable today.
- Solr JSONP forces case page HTTP considerations (`CoreController` / SSL).
- Replace `$rootScope.$broadcast` trees with an explicit event or store — re-run event bus inventory first.

**Seam ideas:** dual-run (Angular + new) for read-only display first; cut over mutations last; feature flag if available.

**Tests:** Karma query/score contracts → Vitest; Playwright baselines for rating + score badge updates, not only static modals.

## App-level seams (brief)

Port only when a UI migration needs them:

| Seam | Note |
|------|------|
| `splainer-search` 3.x | Already ESM; Stimulus can import `createWiredServices`; Angular uses adapter |
| Scorers | Shared helper package direction; not server-only scoring on the case page |
| TLS / JSONP | Mixed content; preserve try state in URL params |
| SearchAPI mappers | `new Function` / MiniRacer — mapper wizard already Stimulus |

## Definition of done (PR)

- [ ] Parity table **per affected surface**
- [ ] Karma → Vitest (or justified drops) for core contracts
- [ ] Matched screenshots per surface (core vs Rails pages not interchangeable)
- [ ] Rails surfaces unchanged unless PR explicitly migrates them
- [ ] Bridges documented if Angular remains
- [ ] Inventory updated; Angular removed only when safe
