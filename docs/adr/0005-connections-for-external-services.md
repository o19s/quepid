# ADR 0005 — Connections: one record for reaching and authenticating to an external service

- **Status:** Proposed (the model, registry, management UI and embedders are built on `feature/connections`; AI judges are not moved yet)
- **Date:** 2026-10-29
- **Affects (when built):** `app/models/llm_provider.rb`, `app/models/embedder_provider.rb`,
  `app/models/embedder.rb`, `app/models/ai_judge.rb`, `app/models/search_endpoint.rb` (later),
  `app/services/llm_connection.rb`, `app/services/llm_service.rb`,
  `app/services/llm_judge_adapters/`, `app/services/embedder_adapters/`, the embedder and AI judge
  forms
- **Builds on:** [ADR 0001](./0001-llm-judge-provider-architecture.md) (the adapter seam and the
  provider registry), `docs/todo/llm_judge_shared_foundation.md` §3.4–3.5 (`LlmConnection`,
  `LlmProviders`)

---

## 1. Context

Quepid now calls external services from three places, and each stores the same things in its own
way:

|                        | AI judge                                                      | Embedder                                                  | Search endpoint                                          |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| Secret                 | `User.llm_key` (encrypted)                                    | `Embedder.api_key` (encrypted)                            | `basic_auth_credential` (encrypted) and `custom_headers` |
| URL                    | `judge_options.llm_service_url`                               | `service_url`                                             | `endpoint_url`                                           |
| Timeout                | `judge_options.llm_timeout`                                   | `timeout`                                                 | none                                                     |
| How the secret is sent | `LlmProvider.auth_style`: `:bearer`, `:api_key`, `:x_api_key` | `EmbedderProvider.auth_style`: `:bearer`, `:none`         | basic auth, or headers the user types                    |
| Registry of vendors    | `LlmProvider`                                                 | `EmbedderProvider`                                        | `search_engine`                                          |
| HTTP client            | `LlmConnection` (Faraday, retry on 429/529)                   | `LlmConnection` too (`EmbedderAdapters::Base#connection`) | the browser, or the proxy                                |
| Owner and sharing      | a user                                                        | owner and teams                                           | owner and teams                                          |

The consequences are practical:

- Someone who uses OpenAI for judging and for embeddings enters the same key twice. Rotating it
  means editing both.
- OpenAI and Ollama each have two registry entries and two copies of the help text.
- Judges and embedders already share one HTTP client (`LlmConnection`), but each builds it from its
  own URL, key and timeout, so nothing ties the calls on one key together.
- Vendors limit per key, but nothing in Quepid knows that judge and embedder traffic share one.
- `LlmProvider.auth_style` names vendors' dialects (`:api_key` and `:x_api_key`), not mechanisms,
  and has no way to say what Elasticsearch needs (`Authorization: ApiKey …`, or basic).
- Adding a service that is neither an LLM nor an embedder (a hosted search engine, a reranker)
  means a third copy of all of this.

### 1.1 Rationale: a pattern other tools already use

Defining a reusable, named entry point to an external service, and having the things that use it
point at it, is a common design in tools like this one. The name varies; the shape does not:

- **Kibana** has _connectors_: a saved, named definition of how to reach a service (a chat
  channel, a ticket system, an LLM provider), with its credentials stored once, that alerting
  rules and other features then reference.
- **Metabase** has _database connections_: an administrator adds a database once, with its host
  and credentials, and every question and dashboard built on it uses that connection.
- **Sentry** has _integrations_: set up once for an organization, then used by the features that
  need to reach the outside service.
- **Airflow** calls them _Connections_, outright: a `conn_id` that every task refers to instead
  of holding a host and a password. **Grafana** _data sources_ and **Jenkins** _credentials_ work
  the same way.

What they share, and what this ADR copies:

1. **Defined once, referenced by name.** The thing that does the work (a rule, a question, a task,
   here a judge or an embedder) holds a reference and its own task settings. It does not hold the
   URL and the key.
2. **The secret is stored with the connection and is write-only.** It is encrypted, never shown
   again, and a blank field on edit means "keep it". Whoever uses the connection can't read it.
3. **The person who manages it is not always the person who uses it.** Administrators or owners
   set it up; others are given use of it.
4. **A test button on the definition itself**, so a bad URL or key is found where it was entered,
   not on the first real call.
5. **One place to change it.** Rotating a key or moving a host is one edit.

This matters more here than it first seems, because the services Quepid talks to are no longer a
short fixed list. They are a growing set of LLM and embedding providers, and search engines
besides, each of which would otherwise get its own copy of the URL, key and timeout on its own
form. Following a familiar design also means a team that has used Kibana connectors or Airflow
connections already knows what a Quepid connection is for, and how to think about who may use it.

This is the reason for the shape of the decision, not a claim that Quepid must match any of these
products feature for feature. Where they differ from each other (what is called a connector,
whether it is per user or per organisation), §2 states what Quepid does. The products above are
named from general knowledge of their documented concepts, not from a feature-by-feature
comparison.

## 2. Decision

Introduce **`Connection`**: a record that says how to reach one service and how to authenticate to
it. It knows nothing about LLMs. What a service can be used for lives in a registry, and the
settings that belong to one task (a model, a prompt, a vector size) stay on the thing that does
the task.

### 2.1 The record

`connections` table, model `Connection`:

| Column                | Notes                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `name`                | shown in pickers                                                                                                    |
| `service`             | registry key (§2.3): `openai`, `anthropic`, `azure_openai`, `voyage`, `cohere`, `ollama`, `jev`, `elasticsearch`, … |
| `base_url`            |                                                                                                                     |
| `auth_scheme`         | §2.2                                                                                                                |
| `auth_header`         | only for `auth_scheme: header`                                                                                      |
| `secret`              | encrypted (`deterministic: false`), never returned by any API or form                                               |
| `extra_headers`       | JSON; headers sent with every request (the search endpoints' `custom_headers`)                                      |
| `timeout`             | seconds                                                                                                             |
| `requests_per_minute` | 0 means no limit; shared by everything that uses the connection (§2.6)                                              |
| `options`             | JSON, for what only some services need (Azure `api_version`)                                                        |
| `owner_id`            | null for an instance-wide connection (§2.5)                                                                         |
| `archived`            | as embedders and search endpoints                                                                                   |

Plus `teams_connections`, as `teams_embedders` and `teams_search_endpoints` work today.

### 2.2 How the secret is sent: `auth_scheme`

Named for the mechanism, not the vendor:

| `auth_scheme` | Sends                                        | Used by                                    |
| ------------- | -------------------------------------------- | ------------------------------------------ |
| `none`        | nothing                                      | Ollama, a local Solr                       |
| `bearer`      | `Authorization: Bearer <secret>`             | OpenAI, Voyage, Cohere                     |
| `basic`       | `Authorization: Basic base64(user:password)` | Solr, OpenSearch, Elasticsearch            |
| `apikey`      | `Authorization: ApiKey <secret>`             | Elasticsearch API keys                     |
| `header`      | `<auth_header>: <secret>`                    | Azure (`api-key`), Anthropic (`x-api-key`) |

`secret` holds one token for every scheme except `basic`, where it holds `user:password`, validated
as `MaskableCredential` validates it now. Masking shows the user name and hides the password for
`basic`, and hides all of it otherwise. The registry gives each service a default scheme (and
header), so picking `anthropic` fills in `header` / `x-api-key`.

The old `LlmProvider` values map directly: `:bearer` → `bearer`; `:api_key` → `header` with
`api-key`; `:x_api_key` → `header` with `x-api-key`; `EmbedderProvider`'s `:none` → `none`.

### 2.3 The registry: services and what they can do

`ConnectionService` replaces `LlmProvider` and `EmbedderProvider`. Like them it is code, not data
(the set of services is code; a record stores only the `key`). An entry has what a connection
needs, and a `capabilities` hash holding what each use needs:

```ruby
{
  key: 'openai', label: 'OpenAI',
  default_base_url: 'https://api.openai.com',
  auth_scheme: 'bearer', requires_secret: true,
  help_html: '…',
  capabilities: {
    chat:       { adapter: 'LlmJudgeAdapters::OpenAi',   default_model: 'gpt-4o', supports_images: true, … },
    embeddings: { adapter: 'EmbedderAdapters::OpenAi',   default_model: 'text-embedding-3-small',
                  supports_dimensions: true, max_batch_size: 2048, … }
  }
}
```

- **Capabilities:** `chat` (a judge that answers in text), `typed_judge` (Jev, which is not a chat
  model, see ADR 0001), `embeddings`, and later `search`. A service lists only those it has.
- The two existing help texts per service merge into one on the entry; capability-specific
  guidance (the embedder's dimension notes) stays on the capability.
- The pickers filter on capability: the embedder form offers connections whose service has
  `embeddings`; the AI judge form offers `chat` and `typed_judge`.
- `LlmProvider` and `EmbedderProvider` become thin readers over `ConnectionService` for one
  release so callers can move over, then go.

### 2.4 What stays with the thing that uses a connection

- **AI judge:** `connection_id`, and its own model, system prompt, API version where it is per
  judge, and the rest of `judge_options`. `llm_key` and `llm_service_url` go.
- **Embedder:** `connection_id`, and its own model, dimensions, truncation, instruction, input
  template and options. `api_key`, `service_url` and `timeout` go (a per-embedder timeout may
  stay as an override).
- **Search endpoint:** not in the first pass (§2.7).

A connection can have several users: one OpenAI connection can back an AI judge and two embedders.

### 2.5 Ownership, sharing and instance-wide connections

- Same rule as embedders: a user sees the connections they own and those shared with their teams.
  Using a connection spends its owner's secret, so sharing a connection with a team lets members
  make calls on that key. That is today's rule for embedders; it now also covers judging, and the
  sharing UI says so.
- A connection with no owner is **instance-wide**, visible to everyone, like communal scorers.
  An administrator creates it. The Ollama container the deployment already runs becomes one,
  replacing the special handling that fills the Ollama URL in at runtime. Its secret is never
  shown to anyone but administrators.
- Use is checked where the call is made, as the diversity endpoint already does: the user must be
  able to see the connection, not merely the case or judge that points to it.

### 2.6 One HTTP client, one rate limit

- `LlmConnection` is renamed `HttpClient` (it is a Faraday client, not a record, and would
  otherwise sit beside the `Connection` model with a near-identical name). It builds a client
  _from a `Connection`_: base URL, auth headers by `auth_scheme`, extra headers, timeout, and the
  existing retry on 429/529. Embedder adapters already use it, and keep doing so.
- `requests_per_minute` is enforced per connection across all callers, because vendors limit per
  key. The mechanism is the one the search endpoint proxy already uses for its limit; this ADR
  does not choose how to share the counter across processes (§5).
- Adapters keep deciding paths, bodies and parsing for their capability. They no longer decide
  authentication or HTTP.

### 2.7 Search endpoints

They are the odd one: the browser often calls them directly, so their credentials are meant to
reach the client unless proxying is on (`require_proxy_with_basic_auth_credentials`), and they
carry mapper code, static files and per-engine quirks. Folding them in has the lowest value and the
highest risk of leaking a secret to a browser that the connection promised to keep server-side.

So they are **not migrated in this decision.** The model leaves room: `basic` and `apikey` cover
their credentials and `extra_headers` covers `custom_headers`. A later ADR should add a
`search` capability and a rule that decides when a connection's secret may be sent to a browser
(for instance, never; a search endpoint using a connection is always proxied).

## 3. Migration

Additive first, then removal.

1. **Create `connections` and the registry.** No behaviour change; the old classes read through.
2. **Backfill.** One connection per existing embedder and one per AI judge that has a key or URL,
   owned by the same user and shared with the same teams. No deduplication: secrets are encrypted
   non-deterministically, so equal keys cannot be found by comparing columns. A later
   "merge duplicates" step (a rake task, then a button) can compare in memory.
3. **Dual read.** Consumers read the connection, falling back to their old columns while those
   still hold data. New writes go to the connection only.
4. **Drop the old columns** (`embedders.api_key`, `service_url`, `timeout`; `users.llm_key`; the
   connection keys inside `judge_options`) one release later, after checking nothing reads them.

## 4. Consequences

- **A key is entered once and rotated once.** "Test connection" lives in one place; the
  embedder's existing check becomes a check of the connection plus the model.
- **The embedder fingerprint depends on the connection.** `Embedder::VECTOR_SETTINGS` includes
  `provider` and `service_url`, so a vector says where it came from. If those move to the
  connection, editing a connection's URL or service changes the fingerprint of every embedder that
  uses it and marks their vectors stale. This is correct (a different server may give different
  vectors for the same model name), but it is a larger blast radius than editing one embedder. The
  connection form warns with the number of embedders affected, and the fingerprint reads the
  values through the association so they stay in it. Changing the secret, name or timeout does not
  change it, as now.
- **Embedders are affected by judge-side changes to a shared connection** and the reverse. That is
  the point of sharing one, and the form lists what uses a connection.
- **A connection cannot be deleted while in use.** Archiving is allowed; an archived connection
  stops working for new calls with a clear error, as an archived embedder does.
- **The registry gets bigger but flatter.** One entry per service instead of one per service per
  use.
- **Code that builds requests no longer sees the secret directly.** `HttpClient` applies it; the
  adapters get a client. This shrinks the places a key can end up in a log or an error message.
- The migration touches the embedder and judge forms, the APIs that expose them, the diversity
  scorer's embedder lookup (ADR 0002) and the seeds and fixtures. The scorer's rule, that the
  case's embedder is used and the user must be able to use it, is unchanged.

## 5. Options considered

- **Keep three silos, share helpers.** Cheaper now. It leaves the key entered twice, no shared
  rate limit, and a third copy for the next kind of service. We already tried this for the HTTP
  client and the registries; the duplication remained in the data.
- **A `Credential` record only (a key store, with URL and settings on each user).** Solves
  rotation but not the repeated URL, timeout and rate limit, and still needs a service registry
  per use. A connection is the smaller idea that covers more.
- **One polymorphic "integration" that also holds the model and prompt.** Rejected: the model,
  prompt and vector options differ per judge and per embedder on one service, which is why one
  connection can serve several.
- **Put it all in `judge_options`-style JSON on a shared owner.** Rejected for the reasons ADR 0001
  gave about free-form hashes: no validation, no masking, no way to filter pickers.

## 6. Open points

- How the per-connection rate limit is shared across web and job processes (the database, the
  cache, or only a soft per-process limit to start).
- Whether to allow a per-consumer timeout override, or only the connection's.
- Services with more than one secret (a cloud provider with a key id and a secret). Out of scope;
  `extra_headers` and `options` are not a place for secrets.
- Who may create an instance-wide connection: administrators only, to start.
- Search endpoints (§2.7): the `search` capability and when a secret may reach a browser.
- Names, if "Connection" proves too broad in the UI: the model stays `Connection`, the label can
  change.

## 7. Phasing

1. `Connection`, `ConnectionService` and `HttpClient`; old classes read through. No visible change.
2. Embedders move onto connections: picker, inline create in the embedder form, backfill.
3. AI judges move onto connections.
4. A Connections page; rate limits; instance-wide connections; the Ollama container as one.
5. Drop the old columns.
6. Search endpoints, under their own ADR.

## 8. Tests

- Registry: every service's capabilities have an adapter that loads; every default
  `auth_scheme` is valid; the old provider keys all resolve.
- `HttpClient`: each `auth_scheme` produces the right header, and `basic` encodes `user:password`;
  the secret never appears in an error message or log line; retry on 429/529 still applies to embedder
  calls too.
- Model: `secret` encrypted and masked; `basic` requires `user:password`; a service with no
  capability for a consumer is rejected by the picker and by validation.
- Access: a user can use only connections they own or that are shared with their teams, plus
  instance-wide ones; the diversity endpoint still refuses a connection the user cannot see.
- Migration: backfill gives one connection per embedder and judge with the same owner and teams;
  dual read prefers the connection; a consumer with both reads the connection.
- Fingerprint: editing a connection's URL changes the embedder fingerprint; editing its secret,
  name or timeout does not.

## 9. Built so far

- `connections` and `teams_connections` tables, `Connection` (secret encrypted and masked, the five
  `auth_scheme`s, extra headers, API version, a `check`), `ConnectionService` (read through
  `LlmProvider` and `EmbedderProvider`, plus Elasticsearch, OpenSearch and Solr), `User#owned_connections`,
  `User#connections_involved_with`, `Team#connections`.
- A **Connections** page in the sidebar: list, create, edit, delete, a read-only view for a
  connection shared with you, team sharing, instance-wide connections for administrators, and a
  **Check connection** button that works on the unsaved form.
- Only the owner changes a connection (an administrator for an instance-wide one). A team member can
  use and see it, but not read the secret, change its URL, or check it with the saved secret: all
  three would let them send the owner's key somewhere else. This is stricter than embedders, which
  any team member can edit.
- Deleting a user deletes their connections. Unlinking them would make them instance-wide.

- **Embedders can use a connection.** `embedders.connection_id` is optional. The embedder form has a
  Connection dropdown (active connections the user can use whose service makes embeddings); picking
  one hides the provider, URL, key and timeout fields, which then come from the connection, and
  follows its service for what the provider decides. Choosing none keeps the embedder's own URL and
  key, so existing embedders are untouched (dual read; no backfill yet). The embedder API takes
  `connection_id`. The fingerprint reads the effective provider and URL, so an embedder on a
  connection has the same fingerprint as one with the same settings of its own, and changing the
  connection's URL or service marks its embedders' vectors stale and re-vectorises their cases.
- A connection can't be deleted while embedders use it (the UI says how many); deleting its owner's
  account deletes it and unlinks them. Switching a connection to a service that can't make
  embeddings is refused while embedders use it.
- Picking a connection is checked against the user doing it, not only the embedder's owner, because
  a team member may be editing someone else's embedder.

Known gap: an embedder can be shared with teams the connection is not shared with. Someone who may
use a connection can put it behind an embedder shared with a third team, whose members then spend
the connection owner's key. Embedders already work this way for their own keys, so this ADR leaves it
alone; the fix is to allow an embedder to be shared only with teams that can also use its connection.

Not built: renaming `LlmConnection` to `HttpClient` and building it from a `Connection`; moving
AI judges onto connections; the backfill of existing embedders and judges; the rate limit (the field is stored, nothing
enforces it); search endpoints.
