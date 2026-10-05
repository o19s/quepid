# Part 17: Embedders

## Overview

An Embedder is a connection to an external API that turns query text into a vector embedding (OpenAI, Voyage AI, Ollama, or any OpenAI-compatible server such as vLLM or TEI). Embedders are owned by a user and shared with teams, like search endpoints. They live at **Embedders** in the left sidebar (the `[::]` icon) and at `/embedders`.

For a local run, the Ollama container needs an embedding model: `docker exec ollama ollama pull all-minilm` (small) or `qwen3-embedding:0.6b` (takes instructions).

## Test scenarios

### 17.1 Create an embedder and test it

- [ ] **Steps:**
  1. Click **Embedders** in the sidebar, then **Create Embedder**.
  2. Cycle the **Provider** dropdown through OpenAI, Voyage AI, Ollama and OpenAI-compatible.
  3. For each, confirm URL and Model fill with that provider's defaults and the **Provider notes** panel updates. OpenAI and Voyage show the API key and hide Instruction/Input template; Ollama hides the API key and shows Instruction/Input template; OpenAI-compatible shows both.
  4. Pick Ollama, set Model to an installed embedding model, Truncation **Native**, Dimensions `128`, and an Instruction.
  5. Click **Test**.
  6. Save.
- **Expected:** Test shows the dimension count, the exact text sent (the instruction wrapped in `Instruct: … / Query: …`) and the first few vector values. Saving redirects to the embedder's edit page with "Embedder was successfully created."
- **Edge cases:**
  - [ ] Voyage AI with Native truncation and Dimensions `300` — Save shows "Dimensions must be one of 256, 512, 1024 or 2048 for Voyage AI".
  - [ ] Truncation **Client-side** shows the Matryoshka warning; the Native option is disabled for a provider without a dimensions parameter.
  - [ ] A wrong key or unreachable URL — Test shows the provider's error in red rather than failing silently.

### 17.2 Edit, clone, share and delete an embedder

- [ ] **Steps:**
  1. Open a saved embedder. Confirm the API key field is empty, with the placeholder "Saved — leave blank to keep it".
  2. Click **Test** without typing a key — it should use the saved key.
  3. Change the name, check a team under **Teams to Share this Embedder With**, save.
  4. From the list, **Clone** it and save the clone without typing a key.
  5. Sign in as a member of the shared team and confirm the embedder appears in their list.
  6. Delete the clone from the list (confirmation dialog).
- **Expected:** The saved key is never rendered into the page; blank keeps it; the clone keeps the source's key; the shared embedder is visible to team members; deleted embedders disappear from the list.
