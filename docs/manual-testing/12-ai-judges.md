# Part 12: AI Judges

## Overview

AI Judges let an LLM stand in for a human judge. `AiJudge` is a `User` subclass with an owner, optional team sharing, provider settings and a system prompt. Assign it to a Book to run automatic judging ("Judge Judy").

## Test scenarios

### 12.1 Create an owned or team-shared AI Judge

- [ ] **Steps:**
  1. Open **AI Judges → Create AI Judge**, or **Create AI Judge** on a Team page (that team starts selected).
  2. Enter a Name; confirm **Test & Refine** appears. Leave teams unchecked for a private judge, or select teams to share it.
  3. Choose an LLM Provider. Confirm registry presets and help, provider-specific options and read-only fields. Switching between chat models and Jev replaces untouched stock prompts while retaining custom instructions.
  4. Enter a key if the provider requires one. Local Ollama can save with a blank key.
  5. Switch between Structured Fields and JSON; confirm only the active representation submits.
     Remove `jev_min_confidence` in JSON and switch tabs both ways; confirm the old floor is cleared.
     Omit OpenAI's URL/model/timeout in JSON and repeat; confirm the effective defaults return instead of blank connection settings.
  6. Review the System Prompt, test it as described in 12.4, then Save.
  7. Reload and confirm name, provider, prompt and sharing persist; the index shows the owner and teams.
- **Expected:** Top-level Save redirects to the judge form. Legacy nested team submissions return to the team. Successful mutations use Turbo-compatible redirects.
- **Edge cases:**
  - [ ] Blank name/prompt or malformed configuration JSON returns validation errors, retains entered values and team selections, and creates no judge.
  - [ ] Keyless judges still appear as AI judges rather than human accounts.

### 12.2 Edit / delete an AI Judge

- [ ] **Steps:**
  1. From AI Judges or a team member list, edit an owned or team-shared judge.
  2. Change its name, prompt or provider; save and reload.
  3. Change selected teams; confirm only teams visible to you are changed. Existing sharing with other teams remains intact.
  4. From AI Judges, click Delete. Cancel first, then confirm deletion of a disposable judge without judgements.
- **Expected:** Edits persist. The confirmation dialog deletes the judge and returns to the index. Removing team membership remains available separately (Part 9.4).
- **Edge cases:**
  - [ ] A private judge belonging to another user cannot be viewed, edited or deleted (12.7).
  - [ ] A judge with existing judgements retains the existing deletion restriction.

### 12.3 Assign an AI Judge to a Book

- [ ] **Steps:**
  1. Open a new Book or an accessible Book's Settings. The book need not share a team with the judge.
  2. Select an AI judge you own or that is shared with one of your teams.
  3. Select a Rating Scale when required, save, reopen Settings and confirm the assignment remains checked.
- **Expected:** Overview shows the assigned judge's helping text. An eligible unassigned judge produces the Add AI Judge call-to-action. Eligibility belongs to the viewer; inaccessible judges are omitted, and existing hidden assignments survive a visible selection update.
- **Edge cases:**
  - [ ] Assign your private judge to a teamless owned book or to a book you can edit through team sharing.
  - [ ] Submitting an inaccessible judge ID is rejected without replacing existing assignments.

### 12.4 Test & Refine an AI Judge's prompt

- [ ] **Steps:**
  1. Open Create/Edit AI Judge, or Refine Prompt from a book's Judgement Stats.
  2. Confirm Test & Refine loads an editable sample pair from an accessible book (the selected book when provided).
  3. Click Change Query Doc Pair and confirm it loads another sample when available.
  4. Edit the unsaved prompt, active provider configuration and sample document, then Run Prompt.
  5. Confirm the busy indicator followed by rating/explanation; a zero rating must display.
  6. Reload without Save: judge configuration must revert to the saved values. Run Prompt must not create judges, pairs or judgements.
  7. Save explicitly and reload to verify persistence.
- **Expected:** Testing uses current form values and the selected book's rating scale; missing or off-scale ratings appear as Unrateable, using the same acceptance rules as a judging run. Samples respect the requesting user's book access. Legacy prompt routes remain compatible.
- **Edge cases:**
  - [ ] Malformed Document Fields, Options or provider JSON produces a recoverable error; correct it and retry.
  - [ ] A provider failure re-enables Run Prompt and retains input for retry.
  - [ ] Without a book scale, change `llm_provider` directly in JSON between Jev and OpenAI; confirm Run Prompt is disabled only for Jev. Malformed JSON remains runnable to show its recoverable error.
  - [ ] An empty book uses a blank sample. Leaving the page during sampling must not update a disconnected form.

### 12.5 Trigger a judging run ("Judge Judy")

- [ ] **Steps:**
  1. From Overview, click the AI judge's **Judge documents** play button.
  2. In the "Judge Documents" modal, leave the default **Query Doc Pairs to Judge** count (10), click the submit button (labeled "Judge Documents").
  3. Confirm the redirect notice ("AI Judge {name} will start evaluating query/doc pairs.") and watch for live progress notifications on the book pages as the background job runs.
  4. Confirm afterward that up to the requested number of new judgements were created and attributed to the AI judge (fewer if the book ran out of unjudged pairs first).
  5. Repeat, but this time check **Judge All Pairs** — confirm the submit button's label changes live to **"Unleash the Kraken!!"** — and submit.
  6. Confirm the "kraken unleashed" celebratory modal/animation appears, and that the AI judge eventually works through every remaining unjudged pair in the book.
- **Expected:** Both the bounded run and the "judge everything" run complete correctly, with live progress feedback.
- **Edge cases:**
  - [ ] Simulate (or naturally trigger) the LLM failing to return a usable rating for a given pair — confirm that specific judgement is marked `unrateable` rather than the whole run erroring out.
  - [ ] Trigger a run when the book already has zero unjudged pairs left — confirm it completes immediately having processed 0, without error.
  - [ ] Confirm a run with no available pairs completes without new judgements; availability follows the book's selection strategy and Rank Depth.

### 12.6 AI Judge image options

- [ ] **Steps:**
  1. Create an OpenAI judge. Confirm **Judge with images** is checked by default.
  2. Turn it off, save and reopen; then turn it on, save and reopen. Confirm both choices persist.
  3. Select Ollama or TypeSafe Jev. Confirm the image checkbox is disabled and off, with a provider notice. Switch back to OpenAI and confirm your previous choice returns; save/reload with a text-only provider and repeat.
  4. Switch to the JSON tab and confirm structured inputs are disabled. Set `llm_include_images` to false there, save and reopen.
- **Expected:** The saved option controls whether absolute HTTP(S) document image or thumbnail URLs enter the judging prompt. Ollama and Jev omit image content regardless of the saved option. Text-only document fields remain available.
- **Edge cases:**
  - [ ] With images enabled, provide only `thumb`, or a relative `image` plus absolute `thumb`; confirm the absolute thumbnail is used. If both are absolute, prefer `image`.
  - [ ] With images disabled, confirm neither URL is sent as image content.

### 12.7 Judge ownership and document access

- [ ] **Steps:**
  1. Create a private judge as user A. As unrelated user B, verify it is absent from index/book choices and direct show/edit/update/delete requests fail.
  2. Share it with a team containing B. Confirm B can use and edit it, while sharing with teams B cannot see survives B's update.
  3. Give A a private book with a distinctive document. As B, request a wizard sample without book context and with A's inaccessible book ID.
- **Expected:** Samples never expose A's private documents; judge sharing does not grant access to its owner's books. Confirm owned and team-shared access without requiring book and judge team overlap.

### 12.8 Automatic judging, cancellation and live synchronization

- [ ] **Steps:**
  1. Assign a judge, enable **Auto-run on new pairs**, set Rank Depth to 2, save and reload Settings.
  2. Keep Overview open and populate three ranked pairs from a linked case. Confirm automatic judging covers only eligible pairs, with live count/status/chart updates and ratings appearing in the linked case.
  3. Disable auto-run and clear Rank Depth. Add more pairs, run manually, open live progress and confirm **Stop Judging**. Wait for the provider's current response; confirm counts then stop increasing and saved case ratings remain after refresh.
  4. Force a provider failure. Check the Unrateable judgement's explanation in the non-compact Judgements view. Restore the provider and run again; confirm new successful judgements and synced ratings after refresh.
  5. Save a first human judgement from another tab. Confirm that human's row appears on the already-open Overview; delete their last judgement and confirm the row disappears. Repeat with a missed subscription to exercise polling recovery.
  6. While a bounded manual run is waiting for a provider response, add new eligible pairs with auto-run enabled. Confirm one automatic continuation waits, the manual run retains its requested limit, and the continuation judges the remaining pairs. During cancellation, a conflicting manual restart must not overlap the pending response.
- **Expected:** Only one run per book/judge proceeds at a time; conflicting manual launches still discard. Cancellation prevents subsequent iterations and cancels queued continuations; one in-flight provider response may still save, with the lock held until the worker exits. Failed job rows do not leave activity permanently running. Per-cell updates preserve mounted sparklines. Polling recovers missed/removed rows, and synchronization retains the existing no-feedback-loop contract.

### 12.9 TypeSafe Jev and provider acceptance rules

- [ ] **Steps:**
  1. Select TypeSafe Jev in Create/Edit AI Judge. Confirm Judging instructions, the Minimum confidence number field (0–1), fixed URL/model/version and disabled images.
  2. Without a book scale, confirm Run Prompt is disabled with guidance to open Refine Prompt from a book. A direct preview request without an accessible scale returns 422 without contacting the provider.
  3. Open Refine Prompt from a book with a nonstandard scale such as `[1, 3, 5]`. Confirm the displayed criteria and labels match the book. Run a judgement; confirm the fractional provider score maps to a scale value and the explanation records score, confidence and distribution.
  4. Set a confidence floor above the provider's confidence. Confirm Unrateable with the numeric explanation retained. Save/reload and confirm the confidence setting persists.
  5. Force a 401 or missing-answer response, then restore success and retry. Force a first 429/529 followed by success; confirm two requests and a usable result. Timeouts must not be retried.
- **Expected:** Provider selection controls the request dialect. Chat providers keep their existing routing/authentication and image behavior. Jev takes structured text and book criteria; preview remains unsaved, while judging jobs persist accepted or Unrateable judgements.
- **Coverage note:** Local fixture providers can verify the transport and failure matrix without external keys; distinguish this from a live TypeSafe service run.
