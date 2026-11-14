# AI coding style guide

How Rails code in Quepid is expected to read, for contributors and the coding agents working with
them. These are the review points that come up most often on pull requests. Each rule names a
place in the code that already follows it; copy that shape.

Formatting and linting live elsewhere: see the Code Style section of [AGENTS.md](../AGENTS.md) and
`.rubocop.yml`.

## 1. Reuse the helper that already exists

Before writing a parameter cast, a permission check, a team-sharing step or a formatting helper,
search `app/controllers/concerns/`, `app/models/concerns/` and `app/helpers/` for one. Boolean
params, for example, go through `deserialize_bool_param` (see AGENTS.md).

## 2. Write queries as Active Record

- Query through associations: `where(owner: user).or(where(instance_wide: true))`
  (`Connection.usable_by`).
- Fetch related rows in one query with a subquery, not a loop of queries:
  `Case.where(embedder_id: embedders.select(:id)).find_each` (`Connection#revectorize_embedder_cases`).
- Use the model's existing scopes and lookups (`ConnectionProvider.with_capability(:search)`) instead
  of filtering loaded records with `partition` or `select`.
- Add `.includes(...)` for every association the view renders.
- Memoize a query that does not depend on the loop variable (`@admin_id ||= ...`) and keep it out of
  the loop.

## 3. Keep rules in the model and controllers thin

- A rule about what a record may hold is a model validation, so every path that saves it obeys the
  rule. Rules shared by several models go in a model concern: `ConnectionConsumer` holds the
  connection checks for embedders and AI judges.
- A fixed set of states is an `enum`.
- Prefer a design where the invalid state cannot be saved over a controller check that guards
  against it.

## 4. Permitted params belong to controllers

Keep the permitted attribute list in the controller, written with `params.expect`. When several
controllers accept the same record, share the list through a controller concern
(`Connections::ParameterFiltering#permitted_connection_params`,
`Embedders::ParameterFiltering`), not a `PERMITTED_PARAMS` constant on the model.

## 5. Share code through concerns and `utils/`

- Controller behaviour used in more than one controller becomes an `ActiveSupport::Concern`
  (`TeamAssignable#apply_team_ids`).
- JavaScript shared by Stimulus controllers becomes a module under `app/javascript/utils/`
  (`run_check.js`, `dom.js`, `button_loading.js`); each controller keeps only what differs.

## 6. Name things the way the rest of the app does

- Collections a user can see: `*_involved_with` (`embedders_involved_with`,
  `connections_involved_with`).
- Permission predicates take the user: `manageable_by?(user)`.
- One word per concept across code, UI and docs. Before naming something new, check what scorers,
  cases, books and search endpoints call the same idea.

## 7. One constant for values the controller and view share

When the controller validates a set of values and the view renders them, both read one constant
(`ConnectionsHelper::KINDS`), so the two cannot drift apart.

## 8. Write plain, compact Ruby

- Chain to the result: `.merge(...).except(:llm_service_url, :llm_timeout)`, not a `slice`, a
  conditional and a second assignment.
- One `delegate` line for several methods: `delegate :request_headers, :retry_options, to: :connection`.
- Repeated setter logic goes through one private helper (`Connection#set_option`,
  `#set_numeric_option`).

## 9. Write code and comments a reviewer reads once

- Prefer the obvious implementation to a clever one; a parser or callback a reviewer has to decode
  needs a simpler shape or a one-line reason.
- Comments use plain words and explain why. Remove comments that only describe the change being
  made before the pull request merges.

## 10. Server-rendered views first

- Prefer a server-rendered page and a reload to client-side state in Stimulus.
- Repeated inline styles become one local variable or a CSS class; spacing uses Bootstrap utilities
  (see AGENTS.md).
