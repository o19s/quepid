# Architecture Decision Records

One file per significant, hard-to-reverse decision: why we chose what we chose, what we rejected,
and what it costs us. ADRs are **append-only history** — when a decision changes, write a new ADR
that supersedes the old one rather than editing the old one into agreement with the present.

- Filename: `NNNN-short-kebab-title.md`, numbered in order of creation.
- Status: `Proposed` → `Accepted` → (`Superseded by NNNN` | `Deprecated`).
- Keep the *rule and the reasoning*; implementation detail belongs in `docs/todo/*.md` plans and
  in the code.

| ADR | Status | Subject |
|-----|--------|---------|
| [0001](./0001-llm-judge-provider-architecture.md) | Proposed | LLM-as-Judge provider architecture: the adapter seam, TypeSafe Jev, and OpenAI Batch |
