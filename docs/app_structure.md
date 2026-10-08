# App Structure

This document explains how the app is organized.

## Backend

The backend is written in Ruby using the Ruby on Rails framework.

Most of the backend is comprised of API endpoints for the exception of the admin area and user account or password management section.

The admin section contains a few pages for admins to manage users and default scorers.

The user account and password section are a few pages for the user to set or reset their own password and update their own info.

The API endpoints all live under the `app/controllers/api` folder. The API is versioned, even though there's only one version at the moment: `V1`.

## Frontend
The frontend uses server-rendered Rails views with Stimulus controllers, Hotwire, and plain JavaScript modules. The case workspace is a richer browser application, but Rails still owns its page structure, URLs, and static modal shells.

### Core Frontend App

Start with the relevant Rails view under `app/views/` and the Stimulus controller under
`app/javascript/controllers/`. Shared case-page behavior lives in plain modules under
`app/javascript/utils/`, `app/javascript/stores/`, and `app/javascript/api/`.

`app/javascript/core_runtime.js` constructs one workspace per document through
`utils/core_workspace_runtime.js`, before Stimulus starts. The factory builds
settings, navigation, scorer, document cache, snapshot registry and live-query
capabilities from explicit dependencies. `utils/core_capability_access.js` and
`utils/core_capabilities_runtime.js` expose the complete groups to controllers;
bootstrap loads case data without installing methods into a shared registry.

`controllers/core_bootstrap_controller.js` initializes the user and selected case
from the page's `data-core-bootstrap-initial-value`, selects the requested try,
then loads queries/scorers and starts searching. `core/_bootstrap.json.jbuilder`
reuses API serializers, retaining all tries for tuning/history while excluding
graph scores and duplicate endpoint objects. The attribute is HTML-escaped and
the authorized page response is private with `no-store`, because try settings
include endpoint credentials. Later fresh case/user reads still use JSON APIs.
The live-query owner returns its query capabilities,
commands, lifecycle operations and targeted-search adapter. `QueryCollectionStore`
retains the live Query objects and owns display order, expansion and rated-only
preferences. Its snapshots are derived on read; `QueryDocumentsStore` retains
normalized document projections and reads shared query status, scores and display
preferences from that collection. API query fields are normalized once by
`live_query_factory.js`. `CaseScoreStore` retains the atomically completed scoring
result for case aggregates, persistence and graph consumers. `utils/case_runtime.js` owns
the selected case record; `coreWorkspace.caseState` reads it directly. Query and
book events keep their existing contracts. Controllers own DOM interaction, and
static page and modal structure remains in Rails ERB partials.
Rails supplies scorer and query-sort flags directly to their consuming Stimulus
controllers; bootstrap retains no separate configuration copy. User initialization
uses page data, while wizard-completion persistence keeps its JSON PUT.
Scorer, judgement-book, snapshot-selection and core sharing rows clone ERB templates;
controllers populate JSON data and selection state while retaining existing mutation
owners. Snapshot hydration/scoring stays in the bridge and stores; management sharing
retains its separate Rails select/form surface.

#### Persisted case UI

**Decision:** Permit targeted HTML endpoints for persisted case UI alongside the
existing JSON APIs. Annotations, sharing teams, judgements books and scorer lists now use Rails-rendered
rows; further conversions remain conditional on a concrete maintenance benefit.

Browser-owned repeated content remains appropriate for interactive search results.
Use `ProgressBroadcaster` as an existing pattern for background Turbo Stream updates.

#### Live-query ownership map

`createLiveQueryRuntimeOwner` (`utils/live_query_runtime_owner.js`) is the only
place these modules are wired together. Controllers reach it through the
workspace's `queryCapabilities`, `queryCommands`, `queryLifecycle` and
`targetedSearch` groups; they do not import the modules below directly.

| Concern | Module (`app/javascript/…`) | Owns |
| --- | --- | --- |
| Owner | `utils/live_query_runtime_owner.js` | Wiring in dependency order, per-case state (case number, settings, bootstrapping), the returned capability groups. |
| Factory | `utils/live_query_factory.js` | The one normalized shape of a live Query, for bootstrapped and newly created queries. |
| Commands | `utils/live_query_commands.js` | Rate document/all, paginate, refresh rated docs; sequencing and scheduling per query. |
| Lifecycle | `utils/live_query_lifecycle.js` | Prepare, commit (single/bulk), commit persisted, refresh queries. |
| Collection | `utils/live_query_collection.js` | Bootstrap, stale-request handling and publishing fetched queries to the store. |
| Documents | `utils/live_query_documents.js` | Per-query reset/error/result transitions and publication of document state. |
| Read models | `utils/live_query_read_models.js` | Pure projections: rateable doc lists, document URLs, snapshot diff columns. |
| Events | `utils/live_query_events.js` | Subscribes on the event target and scoring store (see below); the only inbound event bridge. |
| Stores | `stores/query_collection_store.js`, `query_documents_store.js`, `case_score_store.js` | Collection: live Query objects, order, expansion, rated-only. Documents: normalized projections reading status/scores from the collection. Case score: the atomically completed scoring result. |

Lifecycle: the owner is built once per document by `createCoreWorkspaceRuntime`,
before Stimulus starts. `core_bootstrap_controller` then calls
`queryCapabilities.bootstrapQueries`, which clears and repopulates the
collection store. Changing the case or try calls `resetQueryState`/`clearQueries`.

Events consumed (from `live_query_events.js`): `rating-changed` (scoring store),
`query-options:saved`, `pick-scorer:selected`, `judgements:queries-need-reload`,
`imports:queries-need-reload`, `quepid:case-book-updated`. Events emitted by the
owner: `queries-state:changed` and `query-diffs:refreshed`. Add new behavior to
the module that owns that concern rather than a new facade or directory.

`settings_runtime.js` owns tries and selection. Tune Relevance receives a flat form:
query, curator and endpoint edits share the selected try; scalar form fields stay
local and reset on successful history mutations. Its Stimulus controller awaits
save, retains the drawer/tab and navigates to the returned try. Query, snapshot and
wizard consumers retain their existing read/update adapters.

One-off ERB modal templates are cloned by `dynamic_modal.js`; the modal's
`dynamic-modal` controller owns Bootstrap show/hide transitions and teardown.
Detailed Document actions belong to `detailed-document`. Browse and Explain Query
use separate controller instances on their modal content, so replacing a result
row does not own or overwrite an open modal's state. Explain Query cancels copy
feedback on hide/disconnect and ignores superseded template responses. Frog Report
unsubscribes and finalizes charts on hide/disconnect; only the latest chart mounts.
A pending book refresh still reconciles shared queries after close, while feedback
and navigation require the original modal connection.

This is the basic structure of the app and should get you started.

## Long running/async processes
We have a number of long running processes, like exporting/importing files, running a Case, or judging a Book with a LLM.  In all of these we use ActiveJob, which lets us run processes in the background.   The state is stored in the database via SolidQueue.   Websockets are used to communicate with the front end.

## HTTPS / HTTP

Quepid runs on HTTPS where possible, however interacting via JSONP with Solr means that if Solr is under HTTP, then the Quepid page needs to be under HTTP as well.   We configure `ssl_options` to ensure that Quepid is under HTTPS for all pages except the main `/` or `CoreController` page, which is HTTP.
