# Part 12: AI Judges

## Overview

AI Judges let an LLM stand in for a human judge. An AI Judge is modeled as a special `User` belonging to a Team, configured with an LLM provider/key/model and a system prompt. Once assigned to a Book, it can be triggered to auto-judge a batch (or all) of the book's unjudged query/doc pairs — a feature nicknamed "Judge Judy."

## Test scenarios

### 12.1 Create a per-team AI Judge

- [ ] **Steps:**
  1. From a Team's show page, click **Create AI Judge**.
  2. Fill in Name and an **LLM Key** (required — help text notes it must be something, even a placeholder like "abc123").
  3. Choose an **LLM Provider** from the dropdown — try each option in turn: OpenAI, Azure OpenAI, Azure AI Foundry, Azure AI Foundry Serverless, Azure AI Foundry Anthropic, Anthropic, Google Gemini, Ollama. (TypeSafe Jev is listed too, but it is a "coming soon" placeholder — see 12.6.)
  4. For each, confirm the LLM Service URL / Model / API Version fields auto-fill with sensible presets and inline help text updates.
  5. Toggle between the **Structured Fields** and **JSON** tabs for `judge_options` — confirm they're mutually exclusive (editing one disables the other, not just visually but functionally) **and that they agree**: change a field without saving, switch to JSON, and the edit should be there; edit the JSON, switch back, and the fields should show it. Malformed JSON leaves the fields untouched rather than wiping them.
  6. Review/edit the default **System Prompt** (a canned 0–3 relevance-grading prompt with worked examples).
  7. Save.
- **Expected:** Redirects to the Team show page; the new AI judge appears in the members list with a robot indicator and an Edit link.
- **Edge cases:**
  - [ ] Leave LLM Key blank — confirm what actually happens (this field doubles as part of what distinguishes an AI judge from a human user).
  - [ ] Switch providers after already filling in custom URL/model values — confirm the preset auto-fill doesn't silently clobber intentional manual overrides in a confusing way.

### 12.2 Edit / delete an AI Judge

- [ ] **Steps:**
  1. From the team member list, click **Edit** (pencil) on an AI judge.
  2. Change the system prompt, LLM key, or provider, save.
  3. Remove the AI judge from the team (same "x" remove-member control as a human member, Part 9.4).
- **Expected:** Edits persist; removing it drops it from the team like any other member.

### 12.3 Assign an AI Judge to a Book

- [ ] **Steps:**
  1. Ensure the AI judge's team also shares the target book (Part 9.5 / Part 10.2/10.3).
  2. On the Book's **Settings** tab, check the AI judge under "AI Judges Assigned to this Book", save.
- **Expected:** The Book Overview now shows "We have an AI Judge {name} helping us rate documents." Before assignment, if an eligible-but-unassigned AI judge exists, the Overview instead shows an "Add AI Judge to this Book" call-to-action.

### 12.4 Refine an AI Judge's prompt

- [ ] **Steps:**
  1. From the book's **Judgement Stats** tab, click **Refine Prompt** on the AI judge's row — this opens the judge's edit wizard with `?book_id=` set.
  2. Confirm step 1 (Configure) pre-loads the current system prompt, and step 2 (**Test & Refine**) loads a random query/doc pair from the book (editable: query_text, doc_id, information_need, document_fields JSON, options JSON, notes, position).
  3. Click **Change Query Doc Pair** — confirm a different random pair loads.
  4. Edit the judge's text (labelled **System prompt** for a chat provider, **Judging instructions** for a typed one like Jev) and/or the sample document's fields, then click **Run Judgement**.
  5. Confirm a spinner shows, then the "Rating Information" section displays the LLM's returned rating and explanation. With a book selected, the page also shows the rating scale that will be sent: as prose for a chat judge, as the question's criteria for a typed one.
  6. With a book selected (`?book_id=`), get the judge to answer outside that book's scale — e.g. temporarily set the system prompt to something like *"Always respond with {\"judgment\": 3, \"explanation\": \"...\"}"* on a 0/1 book — and run it. Confirm "LLM Response:" shows an **Unrateable** badge rather than the out-of-scale number, and the explanation carries the `[LLM returned rating 3.0, outside the scale [0, 1]]` annotation. Running does **not** save; put the real prompt back before clicking **Save**.
  7. Click **Save** to keep the refined prompt, or **Back to AI Judges** to leave without saving.
- **Expected:** Run Judgement reliably returns a rating + explanation for the sample pair, letting you iterate on the prompt before running it on the whole book. The preview holds the answer to the same rules a real judging run applies, so a rating the book would reject never looks usable here.
- **Edge cases:**
  - [ ] Enter malformed JSON in the Document Fields or Options editors and run it — confirm this fails gracefully (no server error page) rather than crashing.
  - [ ] Run this against a book with **zero** query/doc pairs — confirm a sensible blank/placeholder pair is used instead of erroring.

### 12.5 Trigger a judging run ("Judge Judy")

- [ ] **Steps:**
  1. From Judgement Stats, click **Prepare to Judge!** on the AI judge's row.
  2. In the "Judge Documents" modal, leave the default **Query Doc Pairs to Judge** count (10), click the submit button (labeled "Judge Documents").
  3. Confirm the redirect notice ("AI Judge {name} will start evaluating query/doc pairs.") and watch for live progress notifications on the book pages as the background job runs.
  4. Confirm afterward that up to the requested number of new judgements were created and attributed to the AI judge (fewer if the book ran out of unjudged pairs first).
  5. Repeat, but this time check **Judge All Pairs** — confirm the submit button's label changes live to **"Unleash the Kraken!!"** — and submit.
  6. Confirm the "kraken unleashed" celebratory modal/animation appears, and that the AI judge eventually works through every remaining unjudged pair in the book.
- **Expected:** Both the bounded run and the "judge everything" run complete correctly, with live progress feedback.
- **Edge cases:**
  - [ ] Simulate (or naturally trigger) the LLM failing to return a usable rating for a given pair — confirm that specific judgement is marked `unrateable` rather than the whole run erroring out.
  - [ ] Trigger a run when the book already has zero unjudged pairs left — confirm it completes immediately having processed 0, without error.
  - [ ] Confirm **Prepare to Judge!** is disabled/absent once the AI judge has nothing left to judge, or once the book has already reached its judgements-per-pair cap (cross-reference Part 11.7).

### 12.6 Judge with TypeSafe Jev

Jev is a typed evaluation model rather than a chat model: the book's rating scale is sent as the question's criteria, and the answer comes back as a position on that scale with a probability distribution and a confidence — never prose, and never a rating off the scale. Quepid writes the explanation from those numbers.

- [ ] **Steps:**
  1. Create (or edit) an AI Judge and pick **TypeSafe Jev** as the LLM Provider.
  2. Confirm **LLM Service URL** (`https://api.typesafe.ai`), **LLM Model** (`jev-latest`) and **LLM API Version** fill in and are **read-only** — Jev dictates them — while **LLM Key**, Name and Timeout stay editable. Paste your TypeSafe API key (from `console.typesafe.ai/keys`) into LLM Key and save.
  3. Assign the judge to a book that has a scale with labels (labels become the criteria, so they matter more here than the system prompt does).
  4. From **Judgement Stats**, use **Refine Prompt** with `?book_id=` set — confirm the prompt field is labelled "Judging instructions", not "System prompt", and that Test & Refine lists the **criteria** the question will carry (one row per rating, from the book's scale labels) read-only — then click **Run Judgement**.
  5. Back on Judgement Stats, run a small **Judge Judy** batch (e.g. 10 pairs).
  6. Open the resulting judgements and read the explanations.
- **Expected:** every rating is one of the book's own scale values (Jev cannot return anything else), and each explanation reads like `Jev rated 1 ("Relevant") -- raw score 0.57 of 0-1, confidence 0.35. Distribution: 0: 43%, 1: 57%. (model jev-1.13.0)`.
- **Edge cases:**
  - [ ] Run the prompt preview **without** a book (`/ai_judges/:id/edit` with no `book_id`) — confirm it fails gracefully saying Jev needs a book, rather than sending a question with no criteria.
  - [ ] Point the judge at a book whose scale has **more than 10 values** — confirm it still judges (the question becomes a choice between the rating values rather than a score).
  - [ ] Set **Minimum confidence** to `0.5` on the judge (a number field that appears only while TypeSafe Jev is the provider, stored in the judge's options JSON — no new column) and re-run — confirm answers below that confidence are saved as **unrateable** with their numbers still in the explanation, and that switching provider away hides and disables the field.
  - [ ] Judge a book whose documents have an `image` field — confirm judging still works and the image is simply ignored (Jev is text-only).

### 12.8 Send document images to a judge

A judge whose provider takes image URLs (every one except Ollama and TypeSafe Jev) attaches the document's image to the request as an image URL: the `image` field if the case maps one, otherwise the case's `thumb` (with the case's thumb prefix already applied). Each judge has an **Judge with images** switch so text-only models can be left out. Providers whose API cannot take an image URL (Ollama, TypeSafe Jev) show the switch disabled and off, with a message naming the provider, and never send an image whatever the judge's setting.

- [ ] **Steps:**
  1. Open `/ai_judges/new` — confirm **Judge with images** is a switch and is **on**.
  2. Edit an existing judge saved before the switch existed — confirm it shows **on** too (unset means on).
  3. Turn the switch **off**, open the **JSON** tab — confirm `judge_options` carries `"llm_include_images": "false"`; switch back to **Structured Fields** and confirm it is still off. Save, reopen the judge, confirm it is still off.
  4. Switch the provider to **Ollama**, then **TypeSafe Jev** — confirm the switch goes disabled and off with "<provider> doesn't support images, so none are sent." Switch back to **OpenAI** — confirm the switch is enabled again and shows the choice from before (turn it on before switching away to see it come back on).
  5. In **Test & Refine**, put a document with a `thumb` URL in Document Fields (e.g. `{"title": "Mallard Duck", "thumb": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Anas_platyrhynchos_male_female_quadrat.jpg/330px-Anas_platyrhynchos_male_female_quadrat.jpg"}`) and **Run Judgement** with the switch on, then off.
- **Expected:** with the switch on, a vision model's explanation refers to what the picture shows; with it off, the judge rates from the text alone, and a judge that failed on the image succeeds. Ollama rejects image *URLs* outright (400, "please use base64 encoded data instead") whatever the model, which is why its switch is disabled.
- **Edge cases:**
  - [ ] A `thumb` that is a relative path (a case whose thumb mapping has no prefix, e.g. `/t/p/w500/abc.jpg`) — confirm judging still works and no image is sent, rather than the provider rejecting the request.
  - [ ] A document with both `image` and `thumb` — `image` is the one sent.

### 12.9 Open the New calibration dialog

A calibration runs an AI judge on a random sample of pairs another judge has rated and compares the two (`docs/todo/judge_calibration.md`). Only the page and its dialog exist so far: **Start** stays disabled until running a calibration is built.

- [ ] **Steps:**
  1. Open a book that has human judgements (Book of Ratings) and click the **Judge Calibration** tab, next to Overview and Judge Overview.
  2. Click **New calibration**. Choose an AI judge, then a human under **Compare against**.
  3. Set **Sample size** to `12`, then to more than the reference rated, then back to `50`.
  4. Choose an AI judge with fewer than 30 rated pairs under **Compare against**; then choose the same judge in both lists.
  5. Close the dialog, go to the book overview, and click the ◎ **Calibrate** icon on an AI judge's row in Judge Activity, including an on-call judge.
- **Expected:**
  - The page explains calibration (**What it's for**, **How to use it**, **What you get**, and a **Good to know** note), shows "No calibrations on this book yet.", and the **Judge Calibration** tab is active, with no Overview sub-navigation under it.
  - **Compare against** lists every judge with usable ratings on the book's scale, marked AI or human, with its pair count. Unrateable, judge-later, off-scale and anonymous ratings aren't counted.
  - Once both judges are chosen: "{n} pairs rated by {reference} on the book's scale.", "Between 30 and {n} pairs." (500 at most), and "This makes {size} calls to {judge}." Choosing a reference with fewer pairs than the sample size lowers the sample size to match.
  - A size outside the range shows "Pick a sample size between 30 and {n}." and no call count; the field keeps what was typed.
  - A reference under 30 pairs shows "{reference} has rated only {n} pairs on this book's scale; a calibration needs at least 30."; the same judge in both shows "A judge can't be calibrated against itself."
  - The shortcut opens the Calibration page with the dialog already open and that judge chosen.
  - **Start** is enabled only once both judges are chosen and nothing is wrong. **Same pairs as an earlier calibration** is disabled until the book has a calibration.

### 12.10 Run a calibration and read the result

- [ ] **Steps:**
  1. On Book of Ratings, open **Judge Calibration** → **New calibration**. Calibrate a TypeSafe Jev judge against a human, 50 pairs, and **Start**.
  2. Watch the run's page while it runs, without reloading.
  3. When it's done, click a number in the grade-by-grade table, then open **unrateable answers**.
  4. Click **Tune and run again…**: for the Jev judge lower **Minimum confidence** (e.g. 0.5); for a chat judge (OpenAI) edit the **Prompt**. Start it. While it runs, click **Cancel**, then **Resume**.
  5. On the new run's page, open **Prompt this run used**, and read **{judge}'s runs on these pairs**. Click **Apply these settings to {judge}**, then open the judge's edit page.
  6. Edit the judge's prompt, open the first run again, then go back to **Judge Calibration**.
  7. Start a calibration with **Same pairs as an earlier calibration**.
  8. Start a **New calibration** sampled by **Queries**, 20 of them, against a reference that rated whole top lists (OSC Team Member on Book of Ratings). Then choose a reference that rated only scattered pairs.
  9. On the result, open **Ranks agreement**; then open a pair-sampled run's **Ranks agreement**.
- **Expected:**
  - Only the **Judge Calibration** tab is selected (marked β for beta), and the Overview sub-navigation isn't shown. **What is calibration, and how do I use it?** expands the explanation, on the list and on a run's page. The header says what the judge was measured with (model, and minimum confidence for Jev).
  - The progress bar counts up live, and the results replace it when the run finishes, still on the run's page.
  - The headline gives α (or "Not enough pairs compared" with why, when fewer than 30 rateable answers came back), same grade, within one grade, compared and unrateable counts, and which way the judge leans. Clicking a cell lists exactly its pairs, with the judge's explanations.
  - **Run again** makes a new run on the same pairs with what was entered, without changing the judge: its header says what it was measured with, its page says its settings aren't the judge's saved ones (naming what differs), and **{judge}'s runs on these pairs** lists that judge's runs on the same pairs (not other judges') with their settings and figures, and what changed between them. Cancel stops a run and Resume answers only the pairs it hadn't. **Apply** asks first, then the judge's edit page shows the run's prompt and minimum confidence.
  - After the prompt edit, the first run is marked stale on its page and on the list.
  - The dialog lists each reference's full queries, offers **Queries** with "up to {queries × 10} calls", and for a reference with fewer than 10 full queries disables it and says why, falling back to pairs.
  - A query sample reads "20 queries (200 pairs)" on the list and the run's header. **Ranks agreement** shows Kendall's τ (or why not, under 10 compared queries), the average score shift, the queries moving by 0.1 or more, how many queries were left out for an unrateable answer, the lean, and a per-query table with nDCG@10 for both judges, largest shift first. A pair sample's **Ranks agreement** explains that it needs a sample drawn by queries.
  - A page left open while a run finishes ends on **Done** with **Tune and run again…**, without a reload.
  - No judgement, rating or Judge Activity count changes at any point.
