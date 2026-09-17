# Part 2: Home Dashboard

## Overview

The home dashboard (`/`) is the landing page after login. It surfaces recent cases and books with quick trend summaries, and is the jumping-off point to everything else in Quepid.

## Test scenarios

### 2.1 First-time / empty state

- [ ] **Steps:**
  1. Log in as a brand-new account with zero cases and zero books.
  2. Observe the home page.
- **Expected:** A "Welcome to Quepid!" banner appears with a **Create Your First Relevancy Case** call-to-action button, instead of the normal cards/tables.
- **Edge cases:**
  - [ ] Confirm that having *only* a book (no cases), or *only* a case (no books), is enough to suppress the welcome banner (it should only show when both are empty).

### 2.2 Case summary cards

- [ ] **Steps:**
  1. Log in as an account with several cases (e.g. `realisticActivity`).
  2. Observe the **Case Summary** cards area — up to 4 of the most recently viewed non-archived cases, shown alphabetically.
  3. If a case is scheduled to run nightly, confirm a "nightly"/repeat icon badge appears on its card.
  4. Click a case title link.
- **Expected:** Clicking navigates into that case's core workbench (Part 4). Each card lazily loads a small score-trend chart (see 2.4).
- **Edge cases:**
  - [ ] Confirm archived cases never appear in this list.
  - [ ] Confirm the "up to 4" and "most recently viewed" logic — view a case you haven't touched in a while and confirm it moves up after viewing.

### 2.3 Book summary cards

- [ ] **Steps:**
  1. As an account with books (e.g. `realisticActivity`, which has the Haystack Rating Party book), observe the **Book Summary** cards — up to 4 most recent books.
  2. Confirm each shows a title link and a **Judge** button.
  3. Click **Judge**.
- **Expected:** Judge button takes you directly into the judging screen for that book (Part 11). The detail turbo-frame shows query/judgement counts (see 2.5).

### 2.4 Case score trend card (case_prophet)

- [ ] **Steps:**
  1. Pick a case with at least 3 distinct historical scores (run searches multiple times over time, or use a seeded demo case).
  2. Observe its Case Summary card's trend area.
- **Expected:**
  - Shows the latest score and scorer name.
  - Shows the date range of scoring history.
  - Shows a colored delta line: green "X% increase since Y ago" or red "X% decrease since Y ago", based on detected trend changepoints.
  - Shows a small line chart of score over time, with purple vertical markers at any annotation points — hovering a marker shows a tooltip with the annotation's message.
- **Edge cases:**
  - [ ] A case with 0, 1, or 2 scores — confirm no trend arrow/delta is shown (changepoint detection requires ≥3 points), and the card doesn't error.
  - [ ] A case whose score was exactly 0 at the detected changepoint — confirm no divide-by-zero/NaN% is displayed.
  - [ ] A case with annotations vs. one without — confirm markers only appear when annotations exist.
  - [ ] A case where all scores happened within one calendar day vs. across multiple days — confirm the chart's time axis adapts (hourly vs. daily).

### 2.5 Book summary detail

- [ ] **Steps:**
  1. Observe a Book Summary card's detail area for a book with judging progress, and separately for a brand-new book with 0 queries/judgements.
- **Expected:** Shows total Queries count and "N Judgements across M pairs"; a new book shows zeros without erroring.

### 2.6 Cases table

- [ ] **Steps:**
  1. Scroll to the **Cases** table on the home page.
  2. Confirm columns: ID, Name, # Queries, Last Score, Last Run, Last Run By.
  3. Click **View all Cases**.
- **Expected:** Table shows up to 10 most-recently-viewed cases; the button navigates to the full Cases list (Part 3).

### 2.7 Cookie consent toast

- [ ] **Steps:**
  1. Clear cookies (or use a fresh private browsing session) and log in, in an environment where a cookies URL is configured.
  2. Observe the bottom-right toast.
  3. Click **Learn more** and separately test **Accept**.
- **Expected:** Toast appears once per un-consented session, has a working "Learn more" link, and an **Accept** button that dismisses it and sets a consent cookie (should not reappear on reload after accepting). It should also auto-hide after ~15 seconds if left alone.
- **Edge cases:**
  - [ ] Confirm the toast does not appear at all if no cookies URL is configured for the environment.
