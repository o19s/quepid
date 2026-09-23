# Part 13: Analytics

## Overview

This part covers the standalone analytics pages: the tries visualization (a graph of a case's try history), the case public/private sharing toggle that lives alongside it, and the duplicate-scores diagnostic. (The home-dashboard trend cards and sparklines are covered in Part 2; the in-workbench score/ratings tables are covered in Part 4.13.)

## Test scenarios

### 13.1 Tries visualization

- [ ] **Steps:**
  1. From a case's Tune Relevance drawer → History tab, click "Visualize your tries" (or navigate to `/analytics/tries_visualization/:case_id`).
  2. Confirm a tree/graph of the case's try history renders.
  3. Click **Return to Case**.
- **Expected:** The tree accurately reflects branching try history; if a case's tries have multiple root nodes, confirm they're unified under one synthetic root rather than rendering as disconnected trees.
- **Edge cases:**
  - [ ] Log **out**, then visit the same URL for a case that has been made **public** (13.2) — confirm anonymous access works (this page intentionally allows unauthenticated viewing for public cases).
  - [ ] Attempt anonymous access to a **private** case's tries visualization — confirm it's not accessible.

### 13.2 Case visibility (Public / Private toggle)

- [ ] **Steps:**
  1. While logged in and viewing the Tries Visualization (or Duplicate Scores) page for a case you own, find the **Make Public** button in the page header.
  2. Click it — confirm it becomes **Make Private**, and a "Public" badge with a clipboard icon appears next to the case elsewhere.
  3. Click the clipboard icon — confirm it copies the case's public sharable URL (built from `public_id`, not the internal numeric case ID) to your clipboard.
  4. Paste the copied URL into a private/incognito window (logged out) — confirm it loads.
  5. Return to the case, click **Make Private**.
  6. Retry the same public URL while logged out — confirm it no longer works (404 / access denied / redirect, per current behavior).
- **Expected:** Toggle and clipboard-copy both work correctly; making a case private again actually revokes anonymous access to the old link.
- **Edge cases:**
  - [ ] Toggle visibility while an anonymous user has the tries-visualization page open in another window — confirm their view doesn't break in a confusing way (e.g., silent failure vs. a clear "no longer available" state) on next refresh.
  - [ ] Confirm the Make Public/Private button is **not** shown at all to a logged-out viewer.

### 13.3 Duplicate scores diagnostic

- [ ] **Steps:**
  1. From a case's Scores page (`/cases/:id/scores`), click **Understand Score Duplication**.
  2. Confirm the page groups `Score` rows by try + score + calendar day, showing a Count per group, with the caption "Count of 1 is okay!".
  3. Use **Back to Scores** / **Back to Case**.
- **Expected:** Any group with Count > 1 indicates a real duplicate-scoring issue worth investigating separately; Count of 1 everywhere is the healthy state.
- **Edge cases:**
  - [ ] View this for a case that has never been scored — confirm an empty table renders without erroring.
  - [ ] If you can produce genuine duplicate scores (e.g., by triggering the same nightly run twice), confirm the diagnostic actually surfaces a Count > 1 row for it.
  - [ ] Confirm the Make Public/Private toggle also appears on this page (it shares the same analytics layout as Tries Visualization) and behaves consistently.
