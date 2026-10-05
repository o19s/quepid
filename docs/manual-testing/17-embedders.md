# Part 17: Embedders

## Overview

An Embedder is a connection to an external API that turns query text into a vector embedding (OpenAI, Voyage AI, Cohere, Ollama, or any OpenAI-compatible server such as vLLM or TEI). Embedders are owned by a user and shared with teams, like search endpoints. They live at **Embedders** in the left sidebar (the `[::]` icon) and at `/embedders`.

For a local run, the Ollama container needs an embedding model: `docker exec ollama ollama pull all-minilm` (small) or `qwen3-embedding:0.6b` (takes instructions).

## Test scenarios

### 17.1 Create an embedder and test it

- [ ] **Steps:**
  1. Click **Embedders** in the sidebar, then **Create Embedder**.
  2. Cycle the **Provider** dropdown through OpenAI, Voyage AI, Cohere, Ollama and OpenAI-compatible.
  3. For each, confirm URL and Model fill with that provider's defaults and the **Provider notes** panel updates. OpenAI, Voyage and Cohere show the API key (marked required) and hide Instruction/Input template; Ollama hides the API key and shows Instruction/Input template; OpenAI-compatible shows both.
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
  7. Open the team's page (**Teams** → the team). Find the **Embedders** card.
  8. Click the red ⊗ on the shared embedder and confirm.
- **Expected:** The saved key is never rendered into the page; blank keeps it; the clone keeps the source's key; the shared embedder is visible to team members; deleted embedders disappear from the list. The team page lists the team's embedders (provider, model, size, owner, how many cases use it) with a **Create Embedder** button that pre-selects the team; step 8 shows "… is no longer shared with …", the card empties, and cases already using the embedder keep it.

### 17.3 Pick a case's embedder

- [ ] **Steps:**
  1. Open a case (`/case/:id`). With no embedder set, the header shows only the case, try and scorer names.
  2. Click **Select embedder** in the toolbar (next to Select scorer).
  3. Confirm the modal lists **None** plus every embedder you own or that is shared with one of your teams, each with provider, model and size; the current choice is highlighted and **Select Embedder** is disabled until you pick something else.
  4. Pick an embedder and click **Select Embedder**.
  5. Reload the page.
  6. Reopen the modal, pick **None**, save.
- **Expected:** After step 4 the modal closes and the header shows "— [::] *embedder name*" after the scorer, without a reload; it is still there after step 5. After step 6 the embedder name disappears from the header.
- **Edge cases:**
  - [ ] A case whose embedder was set by a teammate and isn't shared with you: the modal warns that switching away loses access, and still shows it as current.
  - [ ] **Create New Embedder** opens the embedder form in a new tab.
  - [ ] Clone the case: the clone keeps the embedder only if you can see it.

### 17.4 Vectorise a case's queries

- [ ] **Steps:**
  1. Open a case with queries and pick an embedder (17.3). A local Ollama embedding model is enough.
  2. Watch the query rows; open **Select embedder** again to see the summary ("20 pending — vectorising…").
  3. When the run finishes, open a query's **Set Options** and look for `query_vec` and `query_vec_meta`. Close with **Cancel**.
  4. Add a new query.
  5. Edit the embedder (e.g. change Dimensions) and come back to the case.
  6. Switch the case to an embedder with no or a wrong API key.
  7. Click **Re-vectorize all queries** in the picker.
- **Expected:**
  - Step 1–2: every row shows a light grey "pending vectorisation" badge, which disappears as the run finishes, without a reload; the queries search again with the vector.
  - Step 3: `query_vec` has the embedder's size; `query_vec_meta` names the embedder, provider, model, dimensions, truncation, fingerprint, text digest and time.
  - Step 4: the new query has its vector before its first search (no badge).
  - Step 5: rows show "vector outdated" (amber) until the automatic re-run finishes; the tooltip says the settings changed.
  - Step 6: rows show "vectorisation failed" (red); the tooltip has the provider's error (e.g. 401). Older vectors are kept.
  - Step 7: all queries are redone.

