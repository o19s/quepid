# App Structure

This document explains how the app is organized. For a full index of documentation by topic, see [docs/README.md](README.md).

## Quick Reference
- Ruby on Rails
- ViewComponents
- Stimulus
- Turbo (Hotwire)
- ActiveJob
- SolidQueue
- WebSockets
- Bootstrap 5 — see [ui_consistency_patterns.md](ui_consistency_patterns.md) for modals and flash

## Backend

The backend is written in Ruby using the Ruby on Rails framework.

Most of the backend is comprised of API endpoints with the exception of the admin area and user account or password management section.

The admin section contains a few pages for admins to manage users and default scorers.

The user account and password section are a few pages for the user to set or reset their own password and update their own info.

The API endpoints all live under the `app/controllers/api` folder. The API is versioned, even though there's only one version at the moment: `V1`.

**Services:** Shared business logic lives in `app/services/`. Key services include `HttpClientService` (HTTP requests) and `UrlParserService` (URL parsing: scheme, query values, validation). Use these instead of duplicating URL/HTTP logic in controllers.

## Frontend

The frontend uses **Rails + ViewComponents + Stimulus + Turbo**. Server-rendered HTML is enhanced with Stimulus controllers for local behavior and Turbo for dynamic updates.

### Core Frontend App

The first place to look for frontend code:

- **Stimulus controllers:** `app/javascript/controllers/`
- **ViewComponents:** `app/components/`
- **Core workspace layout:** `app/views/layouts/core_modern.html.erb`

The main entry to the app is through a case page. The URL `/case/:id(/try/:try_number)` is served by **Rails** `CoreController#show` (see `config/routes.rb`, `app/controllers/core_controller.rb`). The show action renders the modern layout and view; there is no client-side routing.

**Modern stack:** Layout `app/views/layouts/core_modern.html.erb` loads `application_modern.js` (Stimulus/Turbo) only. For URL building (never hardcode `/`), see [API Client Guide](api_client.md).

**API client:** For client-side API calls, use the centralized fetch wrapper in `app/javascript/api/fetch.js`. Import `apiFetch` — it adds the CSRF token automatically. See [API Client Guide](api_client.md) for URL building and usage.

### Workspace Architecture

The core workspace (`/case/:id/try/:try_number`) is server-centric. For full details:

- **State design:** [workspace_state_design.md](workspace_state_design.md) — server vs client state, Turbo Frame regions
- **User flows and behavior:** [workspace_behavior.md](workspace_behavior.md) — load, add query, rate, export, clone, keyboard shortcuts
- **API contract:** [workspace_api_usage.md](workspace_api_usage.md) — endpoints, request/response shapes
- **Turbo Frames and Streams:** [turbo_frame_boundaries.md](turbo_frame_boundaries.md), [turbo_streams_guide.md](turbo_streams_guide.md)

For development setup (Docker, local, tests, troubleshooting), see [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md).

This is the basic structure of the app and should get you started.

## Long running/async processes
We have a number of long running processes, like exporting/importing files, running a Case, or judging a Book with a LLM.  In all of these we use ActiveJob, which lets us run processes in the background.   The state is stored in the database via SolidQueue.   Websockets are used to communicate with the front end.

## HTTPS / HTTP

Quepid runs on HTTPS where possible, however interacting via JSONP with Solr means that if Solr is under HTTP, then the Quepid page needs to be under HTTP as well.   We configure `ssl_options` to ensure that Quepid is under HTTPS for all pages except the main `/` or `CoreController` page, which is HTTP.

## Cursor / IDE Rules

Project-specific rules for Cursor live in `.cursor/rules/`. They cover: core project setup (Docker, yarn, docs, URLs), Ruby/Rails conventions, and frontend migration (Stimulus, Turbo, ViewComponents). The "Quepid project" rule is always applied; others apply when editing matching file types.
