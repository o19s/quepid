# Optimizing an LLM judge's prompt against a golden dataset

> **Status:** how-to and plan, nothing implemented in Quepid. Background:
> `docs/todo/judge_agreement_and_calibration.md` (§2.4: "calibrate against a gold set, and pick the
> prompt by agreement with it"; Part II: how agreement is measured). Used by the escalation plan, `docs/todo/escalating_judges.md` §5.2.

## 1. The idea

An AI judge in Quepid is mostly its prompt: the system prompt for a chat provider, the "Judging
instructions" for Jev. Today that prompt is tuned by hand in **Refine Prompt**, one sample pair at
a time, by eye.

The industry practice is to tune it against a **golden dataset** instead: a few hundred query/doc
pairs whose grades come from people you trust, and pick the prompt whose answers agree with those
grades best. Bing chose its LLM judge prompt exactly this way, against first-party gold labels,
and checked the choice held up on held-out data (Thomas et al. 2023, §2.2, §5.2 — see
`judge_agreement_and_calibration.md` §2.4). Tools such as DSPy automate the search.

## 2. The golden dataset

### 2.1 Where the grades come from

| Source | Use as gold? | Notes |
| --- | --- | --- |
| **Experts who own the information need** (merchandisers, category managers, the book's owner) | Yes — best | Bailey et al.'s "gold" judges: they know what the query is *for*. |
| **Several experts, disagreements settled** | Yes — better | Also gives the ceiling: an AI judge should not be expected to agree with gold more than experts agree with each other. |
| **Real user behaviour** (purchases, add-to-cart, aggregated clicks) | With care | Bing used real-user feedback. Raw clicks are biased toward whatever ranked high; prefer stronger signals or aggregates. |
| **Trained non-expert raters** | Weak | Bailey's "silver/bronze" judges agree less with experts. |
| **Another AI judge** | No | Circular: it tunes one model to imitate another. |

### 2.2 What makes it usable

- **Size: a few hundred pairs at least.** Rewording one prompt moved agreement with TREC assessors
  between κ 0.50 and 0.72 (Thomas et al. §4.3). On fifty pairs, a "better" prompt is mostly noise.
- **Spread across grades and query types**, hard pairs included. If 80% of gold is "irrelevant", a
  judge that always says 0 looks excellent.
- **Independent of the judge being tuned** — no AI judgements in it.
- **Frozen and split** into a training set the optimizer sees, a validation set it uses to choose,
  and a **test set nobody looks at until the end**. Bing re-ran its choice over 1,000 random
  train/test splits; the winning prompt stayed best in 829.
- **Kept apart from the books you report on.** If gold pairs are also scored for a search
  comparison, the agreement you quote is inflated by the pairs you tuned on.

## 3. Getting the golden dataset out of Quepid

A golden dataset is a book — or part of one — rated by trusted humans. Quepid's **JSON book
export** already carries everything needed (`app/views/api/v1/export/books/*.json.jbuilder`):

```
book: scale, scale_with_labels
  query_doc_pairs[]: query_text, doc_id, position, document_fields, information_need, notes
    judgements[]: rating, unrateable, judge_later, user_email, explanation
```

The judgements CSV (`Api::V1::JudgementsController#index`) is **not** enough: it has `query`,
`docid` and one column per judge, but no document fields.

From the JSON export:

1. Keep judgements whose `user_email` is one of your trusted experts.
2. Drop `unrateable` and `judge_later` rows — they carry no grade.
3. Drop ratings that are not one of the book's `scale` values (book merge can produce averages
   such as 1.5).
4. Where several experts rated a pair, keep it only if they agree, or after the disagreement is
   settled. A pair the experts split on is not gold.
5. Flatten to one row per pair:

```json
{"query": "usb c charger 65w", "doc_id": "8812", "document_fields": {"title": "...", "brand": "..."}, "grade": 2}
```

`scoring_guidelines` is **not** in the export. Jev receives it as part of its instructions, so
copy it from the book's settings if you are tuning a Jev judge.

## 4. Match what the judge actually sees

The optimized prompt will run inside Quepid's request, not the optimizer's. Tuning against
different inputs or a different message layout tunes the wrong thing. For a chat judge
(`LlmJudgeAdapters::Base` and its OpenAI/Anthropic subclasses), Quepid sends:

- **system message:** the judge's system prompt, followed by a scale reminder Quepid appends
  (`system_prompt_for`): *"IMPORTANT: The rating scale is: … The "judgment" value in your
  JSON response MUST be exactly one of these values …"*;
- **user message:** `Query: <query_text>`, a blank line, `doc1:` and the document fields as YAML
  (`user_prompt`), plus the `image` field as an image if present;
- **expected answer:** JSON with `judgment` and `explanation` (OpenAI is called with
  `response_format: json_object`).

Two consequences:

- **The judge never sees `information_need` or `notes`.** If your experts relied on the information
  need, the prompt is being tuned against information the judge cannot have. Leave it out of the
  optimizer's inputs — or treat it as evidence that Quepid should start sending it, which is a
  separate change.
- **The JSON output format lives in the system prompt** (the default prompt asks for it). An
  optimized prompt must keep asking for exactly that JSON, or every judgement becomes unrateable.

## 5. Optimizing with DSPy (chat judges)

DSPy optimizers rewrite a program's instructions, and optionally choose few-shot examples, to
maximise a metric over a training set. MIPROv2 is the usual starting point.

### 5.1 The metric

Use an **ordinal** metric — full credit for the exact grade, partial for one grade off, none
beyond — not exact match. Exact match rewards always answering with the most common grade, and
DSPy scores one example at a time, so it cannot see a chance-corrected statistic. Balance the
training set across grades for the same reason.

### 5.2 A sketch

Illustrative, written against the DSPy documentation for MIPROv2
(`https://dspy.ai/current/api/optimizers/MIPROv2/`); check names against the version you install.

```python
import json, dspy

dspy.configure(lm=dspy.LM("openai/gpt-4o"))

SCALE = [0, 1, 2, 3]  # the book's `scale`

class JudgeRelevance(dspy.Signature):
    """Rate how relevant the document is to the search query."""
    query: str = dspy.InputField()
    document: str = dspy.InputField(desc="document fields as YAML")
    grade: int = dspy.OutputField(desc=f"one of {SCALE}")

program = dspy.Predict(JudgeRelevance)

def load(path):
    rows = [json.loads(line) for line in open(path)]
    return [dspy.Example(query=r["query"], document=r["document_yaml"], grade=r["grade"])
            .with_inputs("query", "document") for r in rows]

train, val = load("gold_train.jsonl"), load("gold_val.jsonl")

def ordinal_metric(example, pred, trace=None):
    if pred.grade not in SCALE:
        return 0.0
    distance = abs(pred.grade - example.grade)
    return 1.0 if distance == 0 else 0.5 if distance == 1 else 0.0

optimizer = dspy.MIPROv2(metric=ordinal_metric, auto="light")
optimized = optimizer.compile(program, trainset=train, valset=val)
optimized.save("optimized_judge.json")
```

The output worth keeping is the **instruction text** the optimizer arrived at (in the saved
program), and any few-shot examples it chose.

### 5.3 Bringing it back into Quepid

DSPy formats its own prompts; Quepid does not use them. So the optimized program does not move
into Quepid as-is:

1. Take the optimized **instructions**, and the chosen **few-shot examples** written out as text.
2. Write them into the AI judge's system prompt, **keeping the JSON output instructions** Quepid
   expects (§4).
3. **Re-validate inside Quepid** on the held-out test set: put the test pairs in a book, run the
   judge over them, and measure agreement with the experts (Krippendorff's α or Cohen's κ — see
   `judge_agreement_and_calibration.md` Part II). This number, not DSPy's training score, is the result.

To shrink the gap between DSPy's score and Quepid's, write a custom DSPy module that sends
*exactly* Quepid's system message (with the scale reminder) and user message, and parses the
`judgment` field — then the optimizer tunes the prompt Quepid will actually run.

Few-shot examples make every call longer, so every judgement costs more. Weigh the agreement gain
against that on a large book.

## 6. Jev

Jev is not a chat model; DSPy cannot drive it without a custom adapter. What can be tuned:

- the **Judging instructions** (the judge's prompt field);
- the book's **scale labels**, which Jev receives as the criteria it chooses between — but labels
  belong to the book, so changing them changes the question for every judge on it, humans
  included;
- `jev_min_confidence`, which is not a prompt but is tuned against the same gold set: the floor
  where accepting Jev's answer still meets an agreement target (`escalating_judges.md` §5.2).

A plain search over a handful of instruction variants, each scored against the gold set through
Quepid itself, is probably enough for Jev.

## 7. Pitfalls

- **Overfitting a small gold set.** Paraphrases alone move agreement widely. Hold out a test set;
  distrust gains smaller than the spread between paraphrases.
- **Model changes.** A prompt tuned for one model version is not guaranteed on the next. Re-run
  the test set when the model behind a judge changes.
- **Scale label edits.** Gold graded under one set of labels, a judge prompted with another: the
  agreement measures the wording change too (`escalating_judges.md` D5, label drift).
- **Agreement is the goal, not a pass rate.** Report α or κ against the held-out set, with the
  number of pairs.
- **Circularity.** If the search configurations you will compare use the same model as the judge
  (a GPT-4o reranker judged by GPT-4o), tuning the judge does not remove its bias toward them.

## 8. What Quepid could add

None of this needs Quepid changes to try once by hand. To make it routine:

1. **A reference judge or book.** Mark which judges' judgements are gold for a book. Needed by
   this workflow and by `judge_agreement_and_calibration.md` (its open question on a human reference).
2. **A gold export.** A rake task or export option: given a book and its reference judges, write
   agreed pairs only, as JSONL, with the document rendered exactly as `user_prompt` renders it
   (`document_yaml`) and the book's scale — the input to §5.2, with no hand filtering.
3. **Agreement against gold on Judgement Stats.** The test-set measurement in §5.3 without leaving
   Quepid — the `judge_agreement_and_calibration.md` Part II work, with the reference judge from (1).
4. **Prompt versions.** Record which prompt produced each judgement, so a tuned prompt can be
   compared with the one it replaced on the same pairs.
