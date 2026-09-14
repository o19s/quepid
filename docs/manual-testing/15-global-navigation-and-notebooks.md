# Part 15: Global Navigation & Notebooks

## Overview

This part covers the chrome that surrounds every logged-in page — the left icon sidebar, the top navbar with its quick-access dropdowns, and the avatar menu — plus two easy-to-overlook standalone features reachable from that chrome: the **API Docs** (OpenAPI/Swagger) page and the **Notebooks** (JupyterLite) integration. None of this is deep functionality on its own, but it's on every page, so a regression here is high-visibility.

## Test scenarios

### 15.1 Left icon sidebar

- [ ] **Steps:** On any logged-in page, confirm the left sidebar shows icons (each with a tooltip on hover) for: Dashboard (home), Relevancy Cases, Judgements (Books), Scorers, Notebooks, Search Endpoints, Teams — plus an avatar dropdown at the bottom with **Create case...**, **Profile**, **Log out**.
- **Expected:** Each icon navigates to the correct page; the icon for whichever section you're currently in is visually highlighted (active state).
- **Edge cases:**
  - [ ] Confirm tooltips appear correctly on hover (this is BS5-tooltip-driven — see Part 16 for known BS3→BS5 tooltip/popover traps).
  - [ ] At a narrow/mobile viewport, confirm the sidebar remains usable (doesn't overlap content or clip icons) — see Part 16.2.

### 15.2 Top navbar quick-access dropdowns

- [ ] **Steps:**
  1. Click **Relevancy Cases** in the top navbar. Confirm a dropdown opens showing "RECENT CASES" (lazy-loaded), with **View all cases** and **Create a case** buttons at the bottom.
  2. Click **Books** in the top navbar. Confirm the equivalent "RECENT BOOKS" dropdown with **View all books** / **Create a book**.
  3. Click **Teams** and **Scorers** navbar links — confirm they navigate directly (no dropdown, just a link).
- **Expected:** Both dropdown lists load their recent items correctly (they're lazy turbo-frames, so allow a moment on slower connections) and the action buttons work.
- **Edge cases:**
  - [ ] As a brand-new user with zero cases/books, confirm the dropdowns show a sensible empty state instead of an empty blank area.
  - [ ] Open a dropdown, then immediately click elsewhere — confirm it closes without lingering rendering artifacts.

### 15.3 External links (User Manual, Wiki, API Docs)

- [ ] **Steps:**
  1. Click **User Manual** in the top navbar — confirm it opens the external docs site in a new tab.
  2. Click **Wiki** — confirm it opens the GitHub wiki in a new tab.
  3. Open the avatar dropdown, click **API Docs**.
- **Expected:** User Manual / Wiki open correctly in new tabs. **API Docs** navigates to the in-app OpenAPI/Swagger documentation page (via the `oas_rails` engine) — confirm the page loads and lists the documented API endpoints (Cases, Queries, Books, Judgements, Scorers, Search Endpoints, Teams, etc.).
- **Edge cases:**
  - [ ] From the API Docs page, try executing a simple read-only request (e.g., "list my cases") if the page supports try-it-out — confirm it authenticates correctly using your current session/API key.

### 15.4 Avatar dropdown & admin shortcuts

- [ ] **Steps:**
  1. Open the avatar dropdown (top-right).
  2. As a non-admin, confirm it shows only: My profile, Log out, (divider), API Docs.
  3. As an admin, confirm it additionally shows: Admin Home, Users, Announcements, Job Manager (each a direct shortcut, in addition to the full Admin Home dashboard in Part 14).
- **Expected:** Admin-only links are strictly hidden from non-admins (not just visually hidden — also confirm they can't be reached by guessing the URL, per Part 14.1).

### 15.5 Cookies static page

- [ ] **Steps:** Navigate to `/cookies` (usually linked from the cookie-consent toast, Part 2.7, or a footer link if present).
- **Expected:** A simple static page renders with the site's cookie policy text, no errors. Confirm the "aboutcookies.org" reference renders as a real clickable link and the "Necessary cookies" paragraph names "Quepid" — both were previously broken (literal unevaluated `#{...}` Ruby interpolation syntax rendering as raw text, since `app/views/pages/cookies.html.erb` had it outside any `<%= %>` tag; one was also an unfilled `#{INSERT SITE HERE}` placeholder) — fixed.

### 15.6 Notebooks (JupyterLite integration)

Quepid ships a bundled JupyterLite environment (pre-built notebooks from the `quepid-jupyterlite` project) for more advanced/scriptable analysis, reachable via the sidebar and navbar "Notebooks" links.

- [ ] **Steps:**
  1. Click **Notebooks** (sidebar icon or navbar link).
  2. Confirm it opens `{root}/notebooks/lab/index.html` in a **new tab**.
  3. Confirm the JupyterLite interface loads (file browser, at least one sample notebook, a working kernel).
  4. Open a sample notebook and run its first cell.
- **Expected:** JupyterLite loads fully client-side (no separate Jupyter server required) and at least one bundled notebook runs without error.
- **Edge cases:**
  - [ ] Confirm this works identically in a fresh Docker environment that has run `bin/setup_jupyterlite` (dev) vs. a deployed environment where the files are baked into the image at build time — if you can test both, confirm neither is broken.
  - [ ] Confirm the link always opens in a new tab (`target="_blank"`) and doesn't navigate away from (or lose state in) the current Quepid tab.
