# Part 19: Embedders

## Overview

An Embedder is a connection to an external API that turns query text into a vector embedding (OpenAI, Voyage AI, Cohere, Ollama, or any OpenAI-compatible server such as vLLM or TEI). Embedders are owned by a user and shared with teams, like search endpoints. They live at **Embedders** in the left sidebar (the `[::]` icon) and at `/embedders`, whose heading is marked β for beta.

For a local run, the Ollama container needs an embedding model: `docker exec ollama ollama pull all-minilm` (small) or `qwen3-embedding:0.6b` (takes instructions).

## Test scenarios

### 19.1 Create an embedder and test it

- [ ] **Steps:**
  1. Open **Connections** and create or check a connection for the embedding service if you do not already have one.
  2. Click **Embedders** in the sidebar, then **Create Embedder**.
  3. Select an owned or instance-wide connection. The connection's provider sets the default Model; provider-specific notes and settings update. The embedder has no URL, key or timeout fields. Ollama shows Instruction/Input template; OpenAI, Voyage and Cohere hide them; OpenAI-compatible shows them.
  4. Pick an Ollama connection and set Model to an installed embedding model, Truncation **Native**, Dimensions `128`, and an Instruction.
  5. Click **Check connection**.
  6. Save.
- **Expected:** Check connection shows the dimension count, the exact text sent (the instruction wrapped in `Instruct: … / Query: …`) and the first few vector values. Saving redirects to the embedder's edit page with "Embedder was successfully created."
- **Edge cases:**
  - [ ] On the connection form, submit `https://example.com/with a space` — Save shows "Base url must be a valid http:// or https:// URL" and does not create a connection. HTTP(S) local hostnames, ports and provider path prefixes remain supported. Missing-host (`https://`) and embedded-newline rejection are covered by model tests; the browser blocks a missing-host submission and strips newlines from the URL field before submission.
  - [ ] Voyage AI with Native truncation and Dimensions `300` — Save shows "Dimensions must be one of 256, 512, 1024 or 2048 for Voyage AI".
  - [ ] Truncation **Client-side** shows the Matryoshka warning; the Native option is disabled for a provider without a dimensions parameter.
  - [ ] A wrong key or unreachable URL — Check connection shows the provider's error in red rather than failing silently.

### 19.2 Edit, clone, share and delete an embedder

- [ ] **Steps:**
  1. Open a saved embedder. Confirm its saved connection is selected; URL, key and timeout come from that connection.
  2. Click **Check connection** — it should use the saved connection's key.
     As a teammate with access to the embedder but no direct access to its connection, confirm
     the check still works with the saved connection. Change the model or sample text before
     checking and reload afterward to confirm the check did not save those changes. A check
     cannot switch to a different connection the teammate cannot use.
  3. Change the name, check a team under **Teams to Share this Embedder With**, save.
  4. From the list, **Clone** it, confirm the same connection is selected, and save the clone.
  5. Sign in as a member of the shared team and confirm the embedder appears in their list.
  6. Delete the clone from the list (confirmation dialog).
  7. Open the team's page (**Teams** → the team). Find the **Embedders** card.
  8. Click the red ⊗ on the shared embedder and confirm.
- **Expected:** The saved key is never rendered into the page; the clone keeps the source's connection only when the new owner owns it or it is instance-wide; otherwise the form explains that a connection must be chosen and does not offer the private original; the shared embedder is visible to team members; deleted embedders disappear from the list. The team page lists the team's embedders (provider, model, size, owner, how many cases use it) with a **Create Embedder** button that pre-selects the team; step 8 shows "… unshared from …", the card empties, and cases already using the embedder keep it.

### 19.3 Pick a case's embedder

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

### 19.4 Vectorise a case's queries

- [ ] **Steps:**
  1. Open a case with queries and pick an embedder (19.3). A local Ollama embedding model is enough.
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
  - Step 7: the button shows a spinner and "Vectorising…" while the request is queued and the job is running; all queries are redone.


### 19.5 Private and instance-wide connections

- [ ] **Steps:**
  1. Create a named Ollama connection with its URL and no authentication. Check it before saving; verify an invalid URL is rejected and a reachable provider reports success.
  2. Open **Access**. There is no team picker. A non-administrator has no instance-wide control; an administrator can choose **Instance-wide** at creation. Save a private connection and reload it.
  3. Create an embedder using that private connection. Confirm it selects the provider and default model from the connection, check it, save it and share the embedder with a disposable team containing another human user.
  4. As that teammate, verify the connection is absent from **Connections** and cannot be opened directly. Open the shared embedder, change its sample text/model and check it. Reload to verify the check saved nothing; rename and save it to verify normal editing still works.
  5. Clone the shared embedder. The private original connection is not offered; a notice asks for an owned or instance-wide connection. Select one available to the teammate and save the copy.
  6. As an administrator, create an instance-wide connection. Verify its owner remains shown and its availability survives reload. As the teammate, select it in a new embedder and verify its provider determines the embedder settings; the teammate cannot edit or delete the connection.
  7. Remove the disposable copies, shared embedder, connections and team. An in-use connection must refuse deletion until its embedder is removed.
- **Expected:** Connection access is independent of team membership. Sharing a configured embedder permits use of its existing connection without granting permission to attach that private connection to a new configuration. Instance-wide availability is explicit and retains a responsible administrator owner. Existing cases continue using their assigned embedder after it is unshared.
