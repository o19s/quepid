# Part 12: AI Judges

## Overview

AI Judges let an LLM stand in for a human judge. An AI Judge is modeled as a special `User` belonging to a Team, configured with an LLM provider/key/model and a system prompt. Once assigned to a Book, it can be triggered to auto-judge a batch (or all) of the book's unjudged query/doc pairs — a feature nicknamed "Judge Judy."

## Test scenarios

### 12.1 Create a per-team AI Judge

- [ ] **Steps:**
  1. From a Team's show page, click **Create AI Judge**.
  2. Fill in Name and an **LLM Key** (required — help text notes it must be something, even a placeholder like "abc123").
  3. Choose an **LLM Provider** from the dropdown — try each option in turn: OpenAI, Azure OpenAI, Azure AI Foundry, Azure AI Foundry Serverless, Azure AI Foundry Anthropic, Anthropic, Google Gemini, Ollama.
  4. For each, confirm the LLM Service URL / Model / API Version fields auto-fill with sensible presets and inline help text updates.
  5. Toggle between the **Structured Fields** and **JSON** tabs for `judge_options` — confirm they're mutually exclusive (editing one disables the other, not just visually but functionally).
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
  1. From the book's **Judgement Stats** tab, click **Refine Prompt** on the AI judge's row.
  2. Confirm the left panel pre-loads the current system prompt, and the right panel loads a random query/doc pair from the book (editable: query_text, doc_id, information_need, document_fields JSON, options JSON, notes, position).
  3. Click **Change Query Doc Pair** — confirm a different random pair loads.
  4. Edit the system prompt and/or the sample document's fields, click **Run Prompt**.
  5. Confirm a spinner shows, then the "Rating Information" section displays the LLM's returned rating and explanation.
  6. Click **Back** to return to Judgement Stats, or **Edit Judge** to go to the full AI judge edit form instead.
- **Expected:** Run Prompt reliably returns a rating + explanation for the sample pair, letting you iterate on the prompt before running it on the whole book.
- **Edge cases:**
  - [ ] Enter malformed JSON in the Document Fields or Options editors and click Run Prompt — confirm this fails gracefully (no server error page) rather than crashing.
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
