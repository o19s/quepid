# Part 16: Cross-Cutting — Bootstrap 5 Migration, Responsive & Accessibility Regressions

## Overview

Quepid is mid-migration off Bootstrap 3 (AngularJS's original styling) onto Bootstrap 5, layered as: npm Bootstrap 5 → `core-additions.css` (Quepid layout) → `bootstrap5-compat.css` (BS-class shims for the Angular `core` app). This creates a specific, recurring class of bug that functional testing alone won't catch: **an element can be present in the DOM, correctly wired (`aria-describedby` set, click handlers firing), and still be invisible** — wrong `display`, `opacity: 0`, a stray `transform`, or a font-size collapsed by an unscoped legacy rule. A tester clicking through the happy path can easily miss this because the *behavior* looks right even when the *paint* is wrong.

This part is a checklist for exactly that class of regression, plus general responsive/narrow-viewport and accessibility sweeps. Run it whenever BS5-related CSS/JS changes, or as a periodic full-app sweep. It complements (doesn't replace) the automated Playwright suite in `test/playwright/` — see `DEVELOPER_GUIDE.md`'s "Playwright E2E" section to run that suite yourself (`bin/docker r yarn test:e2e`), and treat any manual finding here as a candidate to also encode as a new Playwright spec.

## Test scenarios

### 16.1 Popover & tooltip paint check (BS3↔BS5 trap)

Every rating badge, and various icon buttons throughout the app, use BS5 popovers/tooltips (see `quepidPopover.js` / `quepidTooltip.js`).

- [ ] **Steps:**
  1. In the Core Workbench, expand a query and click a document's rating badge to open its popover.
  2. Open your browser's DevTools, inspect the popover element, and check its **Computed** styles: `display`, `opacity`, `transform`, `font-size`.
  3. Repeat for at least one tooltip (e.g., hover a sidebar icon, Part 15.1) and one other popover-driven control elsewhere in the app (e.g., a share modal's info icon, if any).
- **Expected:** `display` is not `none`, `opacity` is `1` (or transitioning toward it, not stuck at `0`), no unexpected `transform: scale(0)`/`translate` pushing it off-screen, and `font-size` looks proportionate to surrounding text (not collapsed to a tiny fixed px value from a legacy `small { font-size: 11px }`-style leak).
- **Edge cases:**
  - [ ] Confirm the popover/tooltip is visible **on first click/hover**, not just after a second interaction (a common symptom of an early-layer CSS rule winning over the intended BS5 one).
  - [ ] Check this at both the default viewport and the narrow viewport (16.2) — some of these bugs only manifest once BS5's responsive font-size (RFS) scaling kicks in.

### 16.2 Narrow viewport reflow sweep

Quepid's automated suite specifically tests a **768×900** viewport in addition to the default 1280×900, because grid/gutter and header layout regressions often only appear at the narrower width.

- [ ] **Steps:** Resize your browser (or use DevTools device emulation) to **768×900**, then walk through:
  1. The case wizard (new case creation, Part 3.2) — especially the Endpoint step's accordion.
  2. The Cases list page (Part 3.1) and its header dropdowns (Part 15.2).
  3. A case's full workbench with a query expanded (Parts 4–6).
  4. At least one modal from each major area: Export Case, Import Case, Share Case, Compare Snapshots, Judgements, Explain Query.
- **Expected:** No horizontal scrollbars on the page body; no overlapping/clipped controls; modals remain usable (buttons reachable, text not cut off); the sidebar (Part 15.1) doesn't overlap main content.
- **Edge cases:**
  - [ ] Confirm modals that are meant to scroll internally (tall content) actually do — don't confuse "modal cut off at the bottom of the viewport" with "modal has no scrollbar" — the two look similar but only one is a bug.
  - [ ] Try an even narrower width (e.g., 375px, a typical phone width) even though it's not part of the automated suite — note anything broken, even if mobile isn't officially a target form factor, since it indicates how fragile the layout is at the edge.
  - [ ] **Known issue (confirmed, not yet fixed):** at 768×900 the top navbar's right-hand items (User Manual / Wiki / avatar dropdown) overflow past the right edge — `document.documentElement.scrollWidth` stays `768` (misleading — check `document.body.scrollWidth` instead, which reports `1080`) since the overflow happens on `<body>` (`overflow: auto` there), not `<html>`, so there's no visible horizontal scrollbar at the top of the viewport to reveal it; the avatar/profile/logout menu is effectively unreachable through normal interaction at this width. Root cause: both `_header.html.erb` and `_header_core_app.html.erb` use Bootstrap's unsuffixed `.navbar-expand` class (see `app/assets/stylesheets/navbar-brand.css`), which by design never collapses into a responsive hamburger toggler at any viewport width — the five nav links plus the avatar dropdown simply don't fit in 768px alongside the logo. Fixing this properly needs a responsive toggler (e.g. `.navbar-expand-md` + Bootstrap's collapse component) added to both header partials — real design/frontend work, not a safe one-line CSS patch, so left unfixed pending a deliberate design pass. Reproduce: resize to 768×900, load any page, run `document.body.scrollWidth` (1080) vs `document.body.clientWidth` (768) in DevTools, or note the avatar dropdown button's `getBoundingClientRect()` extends to x≈1080.

### 16.3 Case header typography

- [ ] **Steps:**
  1. Open any case (Part 4), with the case name/title showing in `#case-header h1` and its `<small>` subtitle beneath.
  2. Using DevTools, check the computed `font-size` of the `h1` and of its `<small>` child.
- **Expected:** The h1 reads clearly as a large heading (BS5's `fs-1` scale — expect somewhere around 32px+ depending on breakpoint/RFS), and the subtitle is visibly smaller — specifically about **0.875×** the h1's size, not a fixed small px value. If the subtitle looks the *same size* as the title, or oddly tiny regardless of the title's size, that's the specific historical regression this check exists for (a legacy `small { font-size: 11px }` rule leaking in from elsewhere and overriding the intended proportional sizing).

### 16.4 Modal accessibility spot-check

- [ ] **Steps:**
  1. Open the **Explain Query** modal (Part 6.7) — or any other modal you're testing that day.
  2. If you have access to an accessibility scanner (e.g., the axe DevTools browser extension, or Chrome Lighthouse's Accessibility audit), run it scoped to just the open modal.
  3. Separately, without any tooling: tab through the modal's controls using only the keyboard — confirm focus is trapped inside the modal (doesn't escape to background content), every interactive element is reachable, and pressing **Escape** closes the modal.
- **Expected:** No critical/serious structural or ARIA violations reported (ignore pure color-contrast complaints against the current theme — that's a known, separate concern, not part of this check). Keyboard focus behaves correctly.
- **Edge cases:**
  - [ ] Repeat for at least one other frequently-used modal (Compare Snapshots, Import, Export, Judgements) since modal markup isn't perfectly uniform across the app.

### 16.5 General visual sanity sweep after any CSS/JS change

Whenever you're testing after a CSS, Bootstrap-version, or vendor-JS change (per `CLAUDE.md`, this requires a rebuild — confirm with the dev team that `yarn build` / `yarn build:css` / `yarn build:angular-vendor` has run before testing):

- [ ] Click through every dropdown, modal, popover, tooltip, accordion, and tab control you encounter in your normal testing pass for that day, and actually **look** at them — don't just confirm the click "did something."
- [ ] Compare against a recent baseline screenshot if one exists (see `.playwright-mcp/` conventions in `CLAUDE.md`, or the automated suite's own baselines).
- [ ] If something looks subtly off (wrong spacing, wrong font size, a control that's technically clickable but visually washed-out/misaligned), don't dismiss it as "probably fine" — this exact category of bug is what this part exists to catch, and it's easy to unconsciously explain away.
- [ ] Report anything found with a screenshot and the computed-style values from DevTools (display/opacity/font-size/transform) — that's what turns a vague "this looks wrong" into an actionable bug report for this specific class of issue.
