# ADR 0005 — Connections: one record for reaching and authenticating to an external service

- **Status:** Proposed (the model, registry, management UI and embedders are built on `feature/connections`; AI judges are in their deprecation period, §3)
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

Introduce **`Connection`**: a record that says how to reach one provider and how to authenticate to
it. It knows nothing about LLMs. What a provider can be used for lives in a registry, and the
settings that belong to one task (a model, a prompt, a vector size) stay on the thing that does
the task.

### 2.1 The record

`connections` table, model `Connection`:

| Column                | Notes                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `name`                | shown in pickers                                                                                                    |
| `provider`            | registry key (§2.3): `openai`, `anthropic`, `azure_openai`, `voyage`, `cohere`, `ollama`, `jev`, `elasticsearch`, … |
| `base_url`            |                                                                                                                     |
| `auth_scheme`         | §2.2                                                                                                                |
| `auth_header`         | only for `auth_scheme: header`                                                                                      |
| `secret`              | encrypted (`deterministic: false`), never returned by any API or form                                               |
| `extra_headers`       | JSON; headers sent with every request (the search endpoints' `custom_headers`)                                      |
| `timeout`             | seconds                                                                                                             |
| `requests_per_minute` | 0 means no limit; shared by everything that uses the connection (§2.6)                                              |
| `options`             | JSON, for what only some services need (Azure `api_version`)                                                        |
| `owner_id`            | responsible user owner, always required (§2.5)                                                                                |
| `archived`            | as embedders and search endpoints                                                                                   |

`instance_wide` is an explicit boolean, default false. Connections have no team join table; configured consumers retain their team sharing.

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

### 2.3 The registry: providers and what they can do

`ConnectionProvider` replaces `LlmProvider` and `EmbedderProvider`. Like them it is code, not data
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
- `LlmProvider` and `EmbedderProvider` become thin readers over `ConnectionProvider` for one
  release so callers can move over, then go.

### 2.4 What stays with the thing that uses a connection

- **AI judge:** `connection_id`, and its own model, system prompt, API version where it is per
  judge, and the rest of `judge_options`. `llm_key` and `llm_service_url` go.
- **Embedder:** `connection_id`, and its own model, dimensions, truncation, instruction, input
  template and options. `api_key`, `service_url` and `timeout` go (a per-embedder timeout may
  stay as an override).
- **Search endpoint:** not in the first pass (§2.7).

A connection can have several users: one OpenAI connection can back an AI judge and two embedders.

### 2.5 Ownership and instance-wide connections

- Every connection has a responsible user owner. Private connections can be selected for new
  configurations only by that owner; only the owner can change or delete them.
- An administrator can create an explicitly **instance-wide** connection. Everyone can select
  it and administrators manage it, while its creator remains the responsible owner. Availability
  is chosen at creation. Missing ownership never grants public access.
- Connections are not shared with teams. Owners share configured embedders (and, once migrated,
  AI judges). Teammates can run, test and edit the consumer using its existing connection without
  gaining permission to attach a private connection to another configuration. A new consumer or
  clone needs a connection its new owner can select. Replacing a connection requires both the
  editor and consumer owner to be able to select it.
- Existing cases retain their assigned embedder after it is unshared. Team sharing controls
  discovery and selection; it does not revoke a configured consumer's ability to run. Delegated
  creation using another person's private credentials is deferred.
- Previously ownerless connections are migrated to explicit instance-wide availability, with
  the first human administrator assigned as owner. If one is needed and unavailable, migration
  stops. Owned connections remain private and existing consumer links are preserved. Removing
  the connection team grants is irreversible; restoring those grants requires a backup.

### 2.6 One HTTP client, one rate limit

- `LlmConnection` is renamed `HttpClient` (it is a Faraday client, not a record, and would
  otherwise sit beside the `Connection` model with a near-identical name). It builds a client
  _from a `Connection`_: base URL, auth headers by `auth_scheme`, extra headers, timeout, and the
  retry. Embedder adapters already use it, and keep doing so.
- **Retries are the client's defaults, which a connection can override** in its Advanced tab:
  how many times (default 3), on which HTTP statuses (default 429 and 529), and the base wait
  (default `LLM_RETRY_INTERVAL`, doubling each time). Blank means the default, so a connection
  states only what differs: a local Ollama can say 0, a rate-limited cloud key can say more. The
  settings live in `options`. A timeout or a dropped connection is never retried, whatever the
  setting: the request may have been done, and repeating it could be paid for twice. What a
  consumer does once retries run out (a judge marks the pair unrateable and may escalate; an
  embedder's job fails) stays with the consumer.
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

## 3. Migration: a deprecation period, then a clean-up

The old settings are not removed when connections arrive. Moving a consumer onto connections goes
through three stages, and a consumer is only cleaned up once the stage before it is done:

1. **Additive.** Create `connections` and the registry. No behaviour change; the old provider
   classes read through.
2. **Deprecation period.** The old way of configuring a consumer is _deprecated_, not removed.
   - The old columns stay in the database and stay optional (`embedders.service_url`, `api_key`,
     `timeout`; later `users.llm_key` and the connection keys inside `judge_options`). Nothing is
     deleted, so nothing that works today stops working.
   - The UI stops editing them. A consumer configured the old way keeps running from them,
     unchanged, and says so on its own screen: the embedder form shows a warning that this is the
     deprecated configuration and that it has to be migrated by choosing a connection.
   - New consumers have to use a connection, and one that has a connection can change it but not
     go back to its own settings. The old way can only shrink during this period.
   - The API keeps accepting the old fields for the same period, so existing integrations are not
     broken at the same time.
3. **Migration, then clean-up.** When the deprecation period ends (the consumers that matter have
   been moved), a data migration turns each remaining consumer's own settings into a connection,
   and a later migration drops the columns and the fallback code.
   - **Data migration.** One connection per consumer that still has a URL or key, owned by the
     same user; team sharing remains on the consumer. Equal ones are not merged in the migration: secrets
     are encrypted non-deterministically, so they can't be compared by column. Where several
     consumers of one owner have the same service, URL and key, the migration compares them in
     memory and reuses one connection. A consumer with no owner is skipped, since nobody could
     use a connection made for it.
   - **Clean-up.** Drop the old columns; delete the fallback in the model (`service_url`,
     `timeout` and `request_headers` reading the consumer's own columns) and the notice; remove the
     old fields from the API.

Clean-up is a separate, later change, made only after the data migration has run everywhere. Doing
the three together would force every consumer onto a connection at once, with no way back if a
backfill got a URL or key wrong; the deprecation period keeps the old settings as the source of
truth until the new ones have been seen to work.

## 4. Consequences

- **A key is entered once and rotated once.** "Test connection" lives in one place; the
  embedder's existing check becomes a check of the connection plus the model.
- **The embedder fingerprint depends on the connection.** `Embedder::VECTOR_SETTINGS` includes
  `provider` and `service_url`, so a vector says where it came from. If those move to the
  connection, editing a connection's URL or provider changes the fingerprint of every embedder that
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

Settled by what was built:

- **Timeout:** only the connection's. A consumer has no override; the embedder form has no timeout
  field.
- **Who may create an instance-wide connection:** administrators only. Availability cannot be
  changed through the form afterwards; administrators manage it, with a responsible owner retained.
- **Names:** the model and the UI both say "Connection".

Still open:

- How the per-connection rate limit is shared across web and job processes (the database, the
  cache, or only a soft per-process limit to start). The field is stored and shown; nothing enforces
  it, and the form says so.
- Delegated authoring with private connections is deferred; consumers remain the team-sharing boundary.
- Services with more than one secret (a cloud provider with a key id and a secret). Out of scope;
  `extra_headers` and `options` are not a place for secrets.
- Search endpoints (§2.7): the `search` capability and when a secret may reach a browser.
- When the data migration and the clean-up (§3) run, and whether the migration reuses one
  connection for consumers of one owner with the same service, URL and key (§3 says yes). Done
  for embedders; still open for judges.
- Embedder-specific duplication that should generalize once AI judges move onto connections,
  not before (nothing to prove the shape against yet): "does this connection fit/is it usable"
  lives on `Embedder` (`connection_fits_and_is_usable`/`connection_problem`) and is mirrored from
  the other direction on `Connection` (`service_still_makes_embeddings`, hardcoding the
  `'embeddings'` capability string); `Connection` also reaches into `embedders` by name for
  provider-sync and re-vectorization (`sync_embedder_providers`, `revectorize_embedder_cases`)
  and for "in use" checks (`ConnectionsController#destroy`/`#show`). When judges land, prefer a
  capability-parameterized shared concern (consumer side) and a generic consumers/capability
  registry (connection side) over a second copy keyed to `chat`/`typed_judge`.
- `EmbeddersHelper#embedder_connection_options`/`#embedder_connection_offered?` build the
  capability-filtered connection picker only for embedders, even though §2.3 says judges need
  the identical picker filtered on `chat`/`typed_judge`. Extract a capability-parameterized
  version when judges build their own picker, rather than recreating the method.
- `Connection#masked_secret`/`self.keep_existing_secret?`/`basic_secret_has_user_and_password`
  re-derive the same "mask a credential, detect a resubmitted masked value, require a colon for
  basic auth" logic the pre-existing `MaskableCredential` concern already has for
  `SearchEndpoint#basic_auth_credential`. The concern is hardcoded to that one attribute name, so
  it doesn't drop in as-is; worth generalizing it to take a configurable attribute instead of
  deriving the same logic a third time.

## 7. Phasing

1. `Connection` and `ConnectionProvider`; the old provider classes read through. Done.
2. A Connections page; instance-wide connections; the Check connection button. Done.
3. Embedders move onto connections: a picker on the form, new ones require a connection, old ones
   keep working and are warned about (the deprecation period, §3). Done.
4. AI judges move onto connections, the same way. In the deprecation period (§9); data migration done, clean-up not started.
5. `HttpClient` replaces `LlmConnection`, built from a connection; rate limits enforced. Not started.
6. The data migration, then, separately, dropping the old columns (§3). Old columns dropped for
   embedders; no existing embedders required a data migration (§9). Judges' data migration done,
   their old columns not yet dropped (§9).
7. Search endpoints, under their own ADR.

## 8. Tests

- Registry: every service's capabilities have an adapter that loads; every default
  `auth_scheme` is valid; the old provider keys all resolve.
- `HttpClient`: each `auth_scheme` produces the right header, and `basic` encodes `user:password`;
  the secret never appears in an error message or log line; retry on 429/529 still applies to embedder
  calls too.
- Model: `secret` encrypted and masked; `basic` requires `user:password`; a service with no
  capability for a consumer is rejected by the picker and by validation.
- Access: new consumers can select owned or instance-wide connections. Shared consumers keep
  using their saved private connection. Direct connection team grants are not supported.
- Migration (judges): backfill gives one connection per judge with the same owner (falling back to
  the lowest-ID human teammate across its teams, then the lowest-ID human administrator, aborting
  first if any judge would be left ownerless), leaving teams on the judge; dual read prefers the
  connection; a consumer with both reads the connection.
- Fingerprint: editing a connection's URL changes the embedder fingerprint; editing its secret,
  name or timeout does not.

## 9. Built so far

- `connections` table, `Connection` (secret encrypted and masked, the five
  `auth_scheme`s, extra headers, API version, a `check`), `ConnectionProvider` (read through
  `LlmProvider` and `EmbedderProvider`, plus Elasticsearch, OpenSearch and Solr), `User#owned_connections`,
  `User#connections_involved_with`.
- A **Connections** page in the sidebar: list, create, edit, delete, a read-only view for an
  instance-wide connection, and a **Check connection** button that works on the unsaved form.
  Connection team sharing is removed; the Access tab describes sharing configured consumers.
- Only the owner changes a private connection; administrators manage instance-wide connections.
  Non-managers never receive the secret or change the destination. A shared embedder may still be
  edited by its team members, using the existing connection.
- Deleting a user deletes their unused connections. Deletion is blocked while any embedder uses
  one of their connections. Connections require an owner regardless of availability.

- **Embedders use a connection.** `embedders.connection_id` is optional in the database. The embedder
  form no longer has URL, key or timeout fields: they come from the connection chosen in a
  Connection dropdown, which lists the active connections the user can use _for the embedder's
  provider_ (an Ollama embedder offers only Ollama connections; with none, a link offers to create
  one). The rest of the form is in three tabs, Model, Instructions and Access. The Check connection
  button is disabled, with a hint to add a connection, until one is chosen. Every embedder needs a
  connection; one can move to another connection but not back to settings of its own.
- **Embedders' clean-up (§3) is done**: there are no existing embedders to migrate, so no data
  migration or deprecation period is needed. `RemoveLegacyColumnsFromEmbedders` drops
  `service_url`, `api_key` and `timeout` from `embedders`. The model's dual-read fallback, the form's "old, deprecated
  configuration" notice, and the API's old fields are gone along with the columns. The
  fingerprint reads the effective provider and URL, so an embedder on a connection has the same
  fingerprint as one with the same settings of its own did, and changing the connection's URL or
  service marks its embedders' vectors stale and re-vectorises their cases.
- A connection can't be deleted while embedders use it (the UI says how many); deleting its owner's
  account is also blocked until those embedders use another connection or are deleted. Switching a connection to a service that can't make
  embeddings is refused while embedders use it.
- Picking a connection is checked against the user doing it, not only the embedder's owner, because
  a team member may be editing someone else's embedder.

Sharing decision: teams share configured embedders, not connections. An embedder's team members
can spend its connection's credentials by using that embedder, but cannot create a separate
configuration with the private connection. Instance-wide connections are the explicit exception.
The clone form clears an inaccessible private connection and asks the new owner to choose one.

- **AI judges use a connection, in their deprecation period (§3, stage 2).** `users.connection_id`
  is optional. The judge form has a Connection dropdown (own and instance-wide connections whose
  provider has `chat` or `typed_judge`) instead of the key field, and no URL or timeout fields;
  the judge's provider comes from its connection (set on save; the form shows it read-only, hidden
  with a "Choose a connection first" placeholder until one is chosen - including for a judge still
  on its own URL and key, which the form no longer marks deprecated or exposes editable hidden
  fields for).
  `LlmService` takes the URL, timeout, retry settings and auth headers from the connection, and the
  API version falls back to the connection's when the judge sets none. New judges need a connection
  (enforced in `AiJudgesController#create`, so code and tests that build judges directly needn't);
  one that has a connection can change it but not drop it. A judge from before connections keeps
  running on its own `llm_key` and `llm_service_url`/`llm_timeout` until someone edits it, but the
  wizard's "Test & Refine" now requires a connection for every judge, no own-settings exception;
  choosing a connection clears them. A clone never takes the original's key or connection: its form
  opens with none and asks the cloner to choose one of theirs.
- The connection checks shared by embedders and judges (who may assign a connection, not dropping
  one) are the `ConnectionConsumer` concern, and the capability-filtered picker is
  `ConnectionsHelper#connection_options_for`, as §6 asked.
- **Per-user LLM connections.** The first time someone who owns no LLM connection opens the AI
  judge form, they get one private connection per LLM provider with its default URL and auth, and
  no key (`User#provision_llm_connections`; saved without validation for that reason). The picker
  marks them "no key yet", and a judging call through one is unrateable with "… has no key yet".
  They are private rather than instance-wide on purpose: on a hosted, multi-tenant Quepid an
  instance-wide connection would be offered to, and spend the key of, every user.
- A connection used by AI judges can't be deleted, nor its owner's account, and its provider can't
  change (a judge's prompt and model are written for its provider). The connection pages count and
  list the judges that use it.
- **AI judges' data migration (§3, stage 3's first half) is done.** `MigrateAiJudgesToConnections`
  backfills a private connection for every judge still on its own key or URL, preserving the key,
  URL, timeout, API version, model and prompt exactly; it resolves an owner (the judge's own, else
  the lowest-ID human teammate across its teams, else the lowest-ID human administrator) and
  aborts before writing anything if any judge would be left ownerless. It is data-only and
  irreversible (`down` raises). With it, manual per-judge migration is no longer needed:
  `migrate_connection` and `AiJudge#migrate_to_connection!` are removed; a judge still found
  without a connection (e.g. built directly, bypassing the migration) can only be pointed at a
  connection by editing it, same as any pre-connection judge. The clean-up half of stage 3 -
  dropping `llm_key` and `judge_options`' URL/timeout - is not done; those columns stay for now.

Not built: renaming `LlmConnection` to `HttpClient` and building it from a `Connection`; dropping
`users.llm_key` and the `judge_options` URL/timeout, the clean-up half of judges' stage 3 (§3); the
rate limit (the field is stored, nothing enforces it); search endpoints.
