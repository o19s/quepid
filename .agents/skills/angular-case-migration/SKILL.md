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

Quepid's **core case UI** (`/case/:id`) was AngularJS. **Rails pages** (cases index, teams, …) already use Stimulus + ERB.

**Goal:** on each surface, ship **equivalent** functionality and appearance using Stimulus, Hotwire, vanilla JS, and Rails as appropriate — **not** "make everything look like Angular", and **not** "reuse one Rails partial everywhere".

- **Core toolbar / case workspace:** match what **Angular** shipped (recover `components/<name>/` templates and use it as the spec for the core surface - don't design from scratch and don't copy the Rails twin).
- **Rails pages that already had a twin:** match what **that Rails partial + controller** shipped (`git show HEAD:`).
- **Reuse is OK on core** when a Rails/Stimulus building block produces the **same** UX as Angular (e.g. shared modal shell + `share-case-core` API stay-on-page paths) — but always verify equivalence on the core surface before considering it a valid replacement.

**Never collapse** unlike surfaces into one template or one interaction model without an explicit product decision and per-surface screenshot proof.

**Canonical docs (do not restate — follow these, update them if the rule changes):**

| Topic | Doc |
|-------|-----|
| Category playbooks / PR order | `docs/todo/angularjs_removal_inventory.md` |
| `$broadcast` before deleting emitters | `docs/todo/event_bus_inventory.md` |
| Docker, Vitest, Playwright E2E | `DEVELOPER_GUIDE.md` (primary human); `CLAUDE.md` § Tests for agent shortcuts |
| Manual scenarios + `tracking.yml` | `docs/manual-testing/README.md` + part files; workflow in `CLAUDE.md` § Manual testing tracker |
| Playwright MCP screenshots | `CLAUDE.md` § UI changes — screenshots via Playwright MCP |

## Per-surface equivalence (do not collapse)

Quepid had **different share-case (and similar) UX on different surfaces** before migration.

### Identify the surface first

| Surface | Layout | Pre-migration share-case UI (example) | Transport |
|---------|--------|----------------------------------------|-----------|
| **Core case** `/case/:id` toolbar | `core.html.erb` | Angular `$quepidModal`: `list-group`, conditional sections, one footer action | `teamSvc` API, stay on page |
| **Rails pages** cases index, teams | `application` | Rails `_share_case_modal` + Stimulus: `<select>`, always-visible "Already shared with", two disabled footer buttons | form POST, redirect |

Other features may have the same split: **core Angular** vs **Rails Stimulus twin**. Inventory both; never assume one partial is the source of truth for all surfaces.

### Rules

1. **Recover what that surface actually shipped** — Angular template/controller on core; `git show HEAD:` for Rails partial/controller on index/teams.
2. **Parity table per surface** — behavior + appearance + transport (API stay-on-page vs form POST redirect).
3. **Reuse Rails/Stimulus on core is fine** when the result **matches Angular** on that surface (same interaction, labels, visibility). Reusing a **cases-index partial** on core without matching Angular is not.
4. **Do not collapse** — one ERB partial with one interaction model for every surface. Use separate controllers/partials (e.g. `share-case` vs `share-case-core`) or explicit controller branches when surfaces differed.
5. **Do not replace Rails page behavior with Angular behavior** — cases index / teams should stay equivalent to their pre-migration Rails UX unless the user explicitly requests a unified redesign.

### Definition of done

See [Definition of done (PR)](#definition-of-done-pr) — every item there is **per surface**, never "closest twin".

### Anti-patterns

- **share-case:** One `_share_case_modal` with Angular list UI on cases index (drops `<select>` and always-visible disabled footers users had there).
- **share-case:** Porting API to core but shipping cases-index dropdown UX on the case toolbar.
- **Either direction:** "Unified modal" without a product decision, separate per-surface parity tables, and per-surface screenshot proof.

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
- [ ] 5. Vitest + Playwright E2E + manual-testing docs
- [ ] 6. Drive manual scenarios via Playwright MCP (+ matched screenshots)
- [ ] 7. Delete Angular + update inventory
```

Vitest + an open-modal screenshot is not done — phases 5–6.

### 1. Inventory the seam

List before editing:

- Angular component/directive + templates under `app/assets/javascripts/components/` or `app/assets/templates/`
- Controllers / services / factories used
- `$broadcast` / `$on` / `$rootScope` events (`docs/todo/event_bus_inventory.md`)
- Karma specs under `spec/javascripts/angular/`
- Existing Stimulus twin on Rails pages (if any) — record as **that surface's** baseline, not core's source of truth
- Playwright coverage (`test/playwright/`, `.playwright-mcp/<topic>/`) and matching `docs/manual-testing/` scenarios (`bin/manual_test_status --paths-for …`)

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
- Port contracts to Vitest with comments naming the Karma examples (commands: `CLAUDE.md` § Tests → JavaScript / `DEVELOPER_GUIDE.md` § Vitest).
- Explicitly document dropped examples (e.g. "modal dismiss is Bootstrap `data-bs-dismiss`").
- Keep Karma for services still used by remaining Angular (`caseSvc` bridges, etc.). Once a service is *only* reachable from the migrated Angular path (e.g. `teamSvc` after `share-case` went fully Stimulus), delete the service, its Karma spec, and any now-dead `$rootScope.$on`/`broadcastSvc.send` calls it fed — don't leave them as unreachable code.

### 4. Implement behind a seam (per surface)

- **Core:** `core_stimulus.js` + modal/API stay-on-page; UI must match Angular; bridge `caseSvc` with `document` CustomEvents when Angular SPA remains.
- **Rails pages:** keep form POST + redirect; UI must match prior Rails partial; button JSON on `data-*` attributes as before.
- **Do not** change Rails page UX to match core unless explicitly requested.
- Server owns URLs (`data-*-url-value`); `apiFetch` for core JSON mutations (`DEVELOPER_GUIDE.md` § Stimulus HTTP conventions).

### 5. Vitest + Playwright E2E + manual-testing docs

How to run / author each layer lives in the canonical docs above. Migration-specific requirements:

- **Vitest** — new/changed Stimulus + utils; include empty states, warnings, config flags (not happy-path only).
- **Playwright E2E** — update specs still targeting Angular / `$quepidModal`; add or extend a path that does the key action (not open-modal-only) when none exists.
- **Manual-testing** — apply CLAUDE.md feature-parity rules to this surface: revise/add/remove `NN-*.md` scenarios as needed; point `tracking.yml` `paths` at the new Stimulus controller, ERB modal, and any Angular bridge.

### 6. Drive those scenarios via Playwright MCP

Follow `CLAUDE.md` § Manual testing tracker and § UI changes. Migration-specific:

- Drive every touched or new scenario for this surface (disposable case/clone when mutating). Open-modal-only only if the mutate path is blocked — say so in `notes`.
- Matched before/after under `.playwright-mcp/<topic>/`. Core pairs ≠ Rails pairs.
- Update `tracking.yml` for scenarios you actually drove.

### 7. Delete Angular + inventory

Only when parity table, phases 5–6, and inventory notes are done:

- Remove component registration and templates; rebuild Angular bundles.
- Update `docs/todo/angularjs_removal_inventory.md` with Done notes and any remaining bridges.
- Do not mark Done for API-only ports.

## Management modals

**Examples:** share-case, clone-case, export-case, delete/archive, judgements entry shell.

**share-case had two live UIs before migration** — see [Identify the surface first](#identify-the-surface-first) for what each shipped, and [Anti-patterns](#anti-patterns) for what is forbidden.

**Allowed:**

- Separate Stimulus controllers/partials per surface (e.g. `share-case` + `share-case-core`), or one controller with **clear branches** when markup is shared.
- Core reuses ERB modal **only** if markup/behavior matches Angular; Rails pages keep HEAD-equivalent markup.

**Worked mistake:** collapsing both surfaces into one list-group partial — correct for core, wrong for index/teams.

## Heavy widgets

**Examples:** diff, import-ratings, export with job polling, frog-report, new-case wizard.

**Extra inventory:** background jobs, ActionCable/progress, multi-step wizards, ACE/CodeMirror, CSV parsers.

**Seam:** often a dedicated esbuild entry or large Stimulus controller; poll/Cable for jobs; do not block the case page on full rewrite of `queriesSvc`.

**Tests:** phases 5–6; MCP shot per wizard step / diff mode.

## Live query state

**Examples:** `queriesCtrl` / `queriesSvc`, `searchResults`, rating controls, case score badges, live `scoreAll()`.

**Do not start** without an explicit state plan from the user / inventory fork. This is the god-object path.

**Hard constraints (from inventory):**

- Live search stays **browser → customer engine** (proxy when needed); batch eval is already server-side.
- Rating must still feel instant: client `scoreAll()` on rating is non-negotiable today.
- Solr JSONP forces case page HTTP considerations (`CoreController` / SSL).
- Replace `$rootScope.$broadcast` trees with an explicit event or store — re-run event bus inventory first.
- Re-render is **decided**: `EventTarget` store + Stimulus subscribers for client-owned state; Turbo Frames only for server-owned state; no reactive framework, no Turbo Streams for scores or docs. Follow `docs/todo/angularjs_removal_inventory.md` § Re-render mechanism — including extracting `scoreDisplay` / `ratingBgStyle` / score sentinels to tested ESM *before* the store, and leaving `scoreAll()` scoping alone.

**Seam ideas:** dual-run (Angular + new) for read-only display first; cut over mutations last; feature flag if available.

**Tests:** Karma query/score contracts → Vitest; phases 5–6. Playwright baselines for rating + score badge updates, not only static modals.

## App-level seams (brief)

Port only when a UI migration needs them:

| Seam | Note |
|------|------|
| `splainer-search` 3.x | Already ESM; Stimulus can import `createWiredServices`; Angular uses adapter |
| Scorers | Shared helper package direction; not server-only scoring on the case page |
| TLS / JSONP | Mixed content; preserve try state in URL params |
| SearchAPI mappers | `new Function` / MiniRacer — mapper wizard already Stimulus |

## Definition of done (PR)

Per-surface checklist — how-to for each item is in the canonical docs table above:

- [ ] Parity table **per affected surface**
- [ ] Vitest contracts; Karma → Vitest (or justified drops) for core
- [ ] Checked-in Playwright E2E updated/added (not only MCP ad-hoc shots)
- [ ] Manual-testing prose + `tracking.yml` `paths` updated for feature parity
- [ ] Affected/new scenarios driven via Playwright MCP; `tracking.yml` `last_run` / `result` / `notes` updated
- [ ] Matched before/after screenshots per surface (core ≠ Rails)
- [ ] Other surfaces unchanged, or listed as migrated in the PR
- [ ] Bridges documented if Angular remains
- [ ] Inventory updated; Angular removed only when safe
