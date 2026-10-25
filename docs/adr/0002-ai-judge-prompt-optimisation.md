# ADR 0002 — Optimise AI judge prompts against human judgements (DSPy-style)

- **Status:** Proposed
- **Date:** 2026-10-25
- **Affects:** `AiJudge#system_prompt`, `LlmJudgeAdapters::Base` (prompt construction only, no
  interface change), the AI judge wizard (`AiJudges::WizardController`)
- **Builds on:** [ADR 0001](./0001-llm-judge-provider-architecture.md): the adapter seam and
  `request_envelope` / `apply_response`

---

## 1. Context

### 1.1 How a judge's prompt is made today

An AI judge's behaviour is almost entirely its `system_prompt`, a free-text string of up to 4000
characters that a person writes by hand in the wizard. `LlmJudgeAdapters::Base#system_prompt_for`
appends a reminder of the book's scale, and `#user_prompt` renders the query plus the
document's fields as YAML. The model answers with `{explanation, judgment}`.

Prompts get better in one way only: someone edits the text, runs `test_prompt` on a few pairs,
looks at the output and decides it seems better. Nothing measures whether a change helped. The
rating that counts is agreement with the team's human judges, and nobody checks it.

### 1.2 What we already have that makes this measurable

- **Labelled data.** A book with human judgements is a set of `(query, document) → rating`
  examples on a known scale (`JudgeScale`). Those are the labels an AI judge is meant to
  reproduce.
- **A pure request/response seam.** ADR 0001's `request_envelope` is deterministic and does no
  I/O, and `apply_response` reads a plain Hash. A harness can score any candidate prompt across
  hundreds of pairs without touching the job, the database or the UI.
- **A place to put the result.** The output of optimisation is still a prompt, and
  `system_prompt` already holds one.

### 1.3 The technique

[DSPy](https://dspy.ai) and similar tools (its optimisers MIPROv2, BootstrapFewShot and COPRO;
GEPA; TextGrad) treat the prompt as a parameter to tune. Given:

1. a **program**, here "rate this query/document pair on this scale",
2. a **training set** of labelled examples,
3. a **metric** that scores one prediction against its label,

the optimiser proposes instruction rewrites and picks few-shot demonstrations from the training
set. It runs each candidate against the examples and keeps the one that scores best on a held-out
split. What comes out is text: instructions plus examples, which can be pasted into any
chat-model judge.

---

## 2. Goal

**Raise each AI judge's agreement with the human judges of the book it serves, and measure it, by
optimising the judge's prompt automatically against that book's human judgements, using
DSPy-style instruction and few-shot optimisation.**

Concretely, success means:

- For a book with enough human judgements, an optimised prompt beats the hand-written baseline on
  a **held-out** set of pairs, by the metric in D3, and we report that number rather than
  asserting it.
- The optimised prompt is an ordinary `system_prompt`. Once it is saved, nothing at judging time
  knows it was optimised.
- Anyone can rerun the optimisation and get the same measurement: which book, which split, which
  model, the score before and the score after.

Non-goals: fine-tuning model weights, optimising Jev (it has no system prompt; see D6), and
changing how judging runs (`RunJudgeJudyJob`, escalation, `JudgementFinalizer`).

---

## 3. Decision

### D1 — The output is a prompt, not a runtime dependency

Optimisation produces a `system_prompt` (instructions plus inline demonstrations), and the judge
stores it like any other. There is no DSPy, Python process or optimiser state on the judging
path.

**Rationale.** It keeps the adapter seam, the batch-readiness contract (ADR 0001 §3) and every
provider exactly as they are. A judge that was optimised can be edited by hand afterwards, copied,
or rolled back by pasting the old text.

*Alternatives rejected:*
- **A DSPy service called at judging time.** It adds a second runtime and a network hop to every
  judgement, for a result that does not change between calls.
- **Porting DSPy to Ruby.** That is a large surface to maintain for a loop that runs rarely and
  offline.

### D2 — Optimisation runs out of process, against Quepid's data through the API

The optimiser runs as an offline Python tool (a script or a JupyterLite/Jupyter notebook, see
`docs/jupyterlite.md`). It pulls a book's query/doc pairs and human judgements from Quepid's API,
calls the same LLM provider the judge uses, and writes the winning prompt back to the judge.

**Rationale.** DSPy and its optimisers are Python. Running them outside Rails keeps Python out of
the app image and leaves the optimisation loop to be iterated on outside Quepid's release cycle.

**Constraint.** The Python program must render each pair **exactly** as `Base#user_prompt` does
(query, then `doc1:` with the fields as YAML, plus the image block when it applies) and must use
the same scale reminder as `#system_prompt_for`. If its rendering drifts from production, it
optimises a judge that does not exist. A fixture shared by both sides, with one rendered pair
checked by a test in Ruby and one in Python, is the guard.

### D3 — The metric is agreement with humans, scored on a held-out split by query

- **Labels:** human judgements only. Leave out ratings from AI judges, `judge_later` and
  `unrateable` rows, and judgements created by escalation (`escalated_from_judgement_id`). When
  several humans rated a pair, use their consensus and set aside pairs where they disagree by more
  than one scale step.
- **Per-example metric:** 1 for an exact match, partial credit for a rating one step away on the
  `JudgeScale`, 0 otherwise. An answer the finaliser would reject (blank or off-scale) scores 0.
- **Reported metric:** quadratic-weighted Cohen's kappa against the human consensus on the test
  split, with exact and within-one-step accuracy next to it.
- **Split by query, not by pair**, roughly 60/20/20 train/validation/test, so a query's documents
  never appear on both sides. Few-shot demonstrations come from the train split only.

**Rationale.** Kappa corrects for a judge that games the label distribution (always answering
"relevant" on a book that is mostly relevant). Splitting by query stops a demonstration about a
query from leaking into the test set, which would inflate the score.

### D4 — Respect the existing prompt budget

`system_prompt` is limited to 4000 characters, and document fields can be large. The optimiser
gets a length budget below that limit, which caps the number of demonstrations and truncates
their fields. Raising the column limit is a separate decision, to make only if measurement shows
the budget is what holds quality back.

### D5 — Every optimised prompt carries its provenance

Next to the prompt, record which book it was trained on, the split seed, the model, the optimiser
and its settings, and the baseline and optimised test scores. Where the record lives (a comment
block in the prompt, `judge_options`, or a dedicated table) is decided by the implementation plan.
The rule is that a prompt claimed as "optimised" can always be traced back to the number that
justified it.

### D6 — Chat-model providers only

OpenAI, Azure OpenAI, Anthropic and other OpenAI-compatible providers are in scope. Jev is out:
it takes per-question criteria built from the scale, not free instructions, so it has nothing for
this kind of optimiser to rewrite.

---

## 4. Consequences

**Positive**

- Teams get a number for judge quality, and the number exists even if they never run the
  optimiser: running the harness on the current prompt alone is already worth having.
- Prompt changes become measured experiments rather than impressions from three `test_prompt`
  runs.
- Nothing changes at judging time, so there is no new risk to existing judges.

**Negative**

- It needs a book with enough human judgements. Small books will overfit, and the tool has to
  refuse or warn below a minimum test-set size rather than report a meaningless gain.
- Optimisation costs LLM calls: candidates × validation pairs, repeated per trial. Each run needs
  an explicit call or spend budget.
- A prompt optimised for one book and one model is specific to both. Moving it to another book or
  another model needs a fresh measurement.
- Rendering parity between Python and Ruby (D2) is a contract that nothing enforces except the
  shared-fixture test.

**Neutral / accepted**

- Demonstrations embed real documents from the book in the prompt, and therefore in every request
  the judge sends to its provider. Those documents already go to the same provider when they are
  judged, so this exposes nothing new to it, but the prompt is no longer generic.

---

## 5. Open questions

- Is the first version a notebook a person drives by hand, or an "Optimise this judge" action in the
  wizard that triggers the external tool? This ADR allows both and requires neither.
- What is the minimum number of human-judged queries before the tool will run? A provisional
  floor is 50 queries in the test split.
- Should the optimiser also be allowed to change *what* the judge sees, such as which document
  fields go into `user_prompt`? That would change the seam's rendering and need its own ADR.

## 6. Revisit triggers

- Optimised prompts consistently hit the 4000-character limit and the budget is measured to be
  the bottleneck: revisit D4.
- A provider adds native support for prompt optimisation or reusable prompt objects: reconsider
  D1's "plain text only".
- Optimised prompts fail to beat the baseline on most books: record that result, and treat it as a
  reason to keep the measurement harness and drop the optimiser.
