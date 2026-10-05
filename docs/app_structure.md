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

`controllers/core_bootstrap_controller.js` loads the user, case and selected try,
then starts searching. The live-query owner returns its query capabilities,
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

This is the basic structure of the app and should get you started.

## Long running/async processes
We have a number of long running processes, like exporting/importing files, running a Case, or judging a Book with a LLM.  In all of these we use ActiveJob, which lets us run processes in the background.   The state is stored in the database via SolidQueue.   Websockets are used to communicate with the front end.

## HTTPS / HTTP

Quepid runs on HTTPS where possible, however interacting via JSONP with Solr means that if Solr is under HTTP, then the Quepid page needs to be under HTTP as well.   We configure `ssl_options` to ensure that Quepid is under HTTPS for all pages except the main `/` or `CoreController` page, which is HTTP.
