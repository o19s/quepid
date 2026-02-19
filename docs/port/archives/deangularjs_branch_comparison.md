# DeAngularJS Migration Summary

> Updated 2026-02-19 | Migration Complete

> **Note:** Completed migration details have been moved to [port_completed.md](port_completed.md). This document remains as a historical summary.

**See also:** 
- The full migration including the **core workspace** (`/case/:id/try/:try_number`) is documented in [deangularjs_experimental_functionality_gaps_complete.md](deangularjs_experimental_functionality_gaps_complete.md).
- For complete component migration list with ViewComponent and Stimulus mappings, see [port_completed.md](port_completed.md#components-fully-migrated).
- For detailed completion records and gap implementations, see [port_completed.md](port_completed.md).

## Overview

This document summarizes the migration from AngularJS to Rails server-rendered views + Stimulus controllers. The migration was completed in phases:

1. **Phase 1 (`deangularjs` branch)**: Migrated **Cases listing**, **Teams**, **Scorers**, and supporting features like sharing modals and import flows.
2. **Phase 2 (`deangularjs-experimental` branch)**: Migrated the core workspace (`/case/:id/try/:try_number`), completing the full removal of Angular from the codebase.

**Current state:** Angular has been **completely removed** from the codebase. The application now uses **37 ViewComponents**, **60 Stimulus controllers**, and server-rendered Rails views throughout. All routes use the modern stack (ViewComponents + Stimulus + Turbo).

---

## What Was Removed

### AngularJS Components (90 files deleted)

Entire component directories under `app/assets/javascripts/components/` were removed:

| Component | Purpose |
|---|---|
| `add_member` | Adding members to a team |
| `archive_case` | Archiving cases (modal + controller + directive) |
| `archive_search_endpoint` | Archiving search endpoints |
| `book_listing` | Listing books |
| `case_listing` | Listing cases |
| `clone_scorer` | Cloning a scorer |
| `delete_scorer` | Deleting a scorer |
| `delete_search_endpoint` | Deleting a search endpoint |
| `edit_scorer` | Editing a scorer (including denied-access modals) |
| `import_to_cases` | Import case and import snapshot modals |
| `new_scorer` | Creating a new scorer |
| `new_team` | Creating a new team |
| `remove_member` | Removing a member from a team |
| `remove_scorer` | Removing a scorer from a team |
| `scorer_form` | Scorer form partial |
| `scorer_listing` | Listing scorers |
| `search_endpoint_listing` | Listing search endpoints |
| `share_scorer` | Sharing a scorer with teams |
| `team_listing` | Listing teams |
| `user_listing` | Listing users |

### AngularJS Controllers (6 files deleted)

- `casesCtrl.js` — Cases index page controller
- `caseImport.js` — Case import controller
- `scorersCtrl.js` — Scorers page controller
- `teamCtrl.js` — Single team view controller
- `teamsCtrl.js` — Teams listing controller
- `unarchiveSearchEndpoint.js` — Unarchive search endpoint controller

### AngularJS Services & Filters (fully removed)

All AngularJS services and filters have been completely removed from the codebase:
- `scorerControllerActionsSvc.js` — **Deleted**
- `teamSvc.js` — **Deleted** (replaced by Rails `teams_controller.rb`)
- `searchEndpointSvc.js` — **Deleted** (replaced by Rails controllers and API endpoints)
- `caseSvc.js`, `bookSvc.js`, `userSvc.js` — **Deleted** (replaced by Rails controllers, Stimulus controllers, and ViewComponents)
- `scorerType.js` filter — **Deleted**
- All other Angular services — **Deleted** (see [angular_services_responsibilities_mapping.md](angular_services_responsibilities_mapping.md) for replacements)

### AngularJS Templates (6 files deleted)

- `views/cases/index.html` and `views/cases/import.html`
- `views/scorers/index.html`
- `views/teams/index.html` and `views/teams/show.html`
- `views/unarchiveSearchEndpointModal.html`
- `views/redirect.html`

### AngularJS Routes

Routes for `/cases`, `/cases/import`, `/teams(/:id)`, and `/scorers` removed from `routes.js` — these no longer go through the AngularJS router.

### Admin Communal Scorers (entire feature removed)

- Controller: `admin/communal_scorers_controller.rb`
- Views: `admin/communal_scorers/` (index, show, new, edit, form)
- Tests: `admin/communal_scorers_controller_test.rb`
- Route: `resources :communal_scorers` removed from admin namespace
- Admin nav link removed from `admin/home/index.html.erb`

This was replaced by allowing admins to edit communal scorers directly from the regular scorers UI (documented in `docs/port/admin_scorer_editing.md`).

### Stylesheets (5 files deleted)

- `books.css`, `scorers.css`, `search_endpoints.css`, `teams.css`, `users.css`

### Test Files

- `spec/javascripts/angular/filters/scorerType_spec.js` — Deleted
- `spec/javascripts/angular/services/teamSvc_spec.js` — Deleted (242 lines)
- `test/controllers/admin/communal_scorers_controller_test.rb` — Deleted (227 lines)

---

## What Was Added

### Rails Controllers (3 new files)

| Controller | Lines | Responsibilities |
|---|---|---|
| `cases_controller.rb` | ~75 | Cases index listing, archive/unarchive actions |
| `scorers_controller.rb` | ~237 | Full CRUD for scorers, clone, share/unshare, set default, test scorer code |
| `teams_controller.rb` | ~541 | Full CRUD for teams, member management, sharing cases/books/scorers/search endpoints, archive/unarchive, member autocomplete |

### Stimulus Controllers (60 total)

The initial migration added 10 Stimulus controllers for Cases, Teams, and Scorers pages:

| Controller | Purpose |
|---|---|
| `confirm_delete_controller.js` | Generic confirmation dialog for delete actions |
| `import_case_controller.js` | Handles case import modal interaction |
| `import_snapshot_controller.js` | Handles snapshot import modal interaction |
| `invite_controller.js` | User invitation flow |
| `scorer_scale_controller.js` | Dynamic scorer scale visualization |
| `share_book_controller.js` | Share/unshare books with teams |
| `share_case_controller.js` | Share/unshare cases with teams |
| `share_scorer_controller.js` | Share/unshare scorers with teams |
| `share_search_endpoint_controller.js` | Share/unshare search endpoints with teams |
| `team_member_autocomplete_controller.js` | Autocomplete for adding team members |

The core workspace migration added 50 additional Stimulus controllers for query management, results display, scoring, annotations, and workspace features. See [deangularjs_experimental_functionality_gaps_complete.md](deangularjs_experimental_functionality_gaps_complete.md) for the complete list.

### Rails Views (13 new files)

**Teams** (`app/views/teams/`):
- `index.html.erb` — Teams listing page
- `show.html.erb` — Team detail page with members, cases, books, scorers, search endpoints
- `new.html.erb` — New team form
- `_books.html.erb` — Books partial for team show
- `_cases.html.erb` — Cases partial for team show
- `_scorers.html.erb` — Scorers partial for team show
- `_search_endpoints.html.erb` — Search endpoints partial for team show

**Scorers** (`app/views/scorers/`):
- `index.html.erb` — Scorers listing page
- `new.html.erb` — New scorer form
- `edit.html.erb` — Edit scorer form
- `_form.html.erb` — Shared scorer form partial
- `_list.html.erb` — Scorer list partial

**Cases** (`app/views/cases/`):
- `index.html.erb` — Cases listing page (~204 lines)

**Shared modals** (`app/views/shared/`):
- `_share_book_modal.html.erb`
- `_share_case_modal.html.erb`
- `_share_scorer_modal.html.erb`
- `_share_search_endpoint_modal.html.erb`
- `_import_case_modal.html.erb`
- `_import_snapshot_modal.html.erb`

### Helpers

- `avatar_helper.rb` (~105 lines) — Generates avatar HTML for users (with Gravatar support)

### Routes

New Rails-native routes added:

```ruby
resources :scorers, only: [:index, :new, :create, :edit, :update, :destroy] do
  post :clone, on: :member
end
post '/scorers/default' => 'scorers#update_default'
post '/scorers/share'   => 'scorers#share'
post '/scorers/unshare' => 'scorers#unshare'

resources :teams, only: [:index, :new, :create, :show] do
  member do
    post :rename
    get  'suggest_members'
    post 'members'
    delete 'members/:member_id'
    delete 'cases/:case_id'
    post 'cases/:case_id/archive'
    post 'cases/:case_id/unarchive'
    post 'search_endpoints/:search_endpoint_id/archive'
    post 'search_endpoints/:search_endpoint_id/unarchive'
  end
  collection do
    post 'cases/share', 'cases/unshare'
    post 'books/share', 'books/unshare'
    post 'search_endpoints/share', 'search_endpoints/unshare'
  end
end

get  '/cases'              => 'cases#index'
post '/cases/:id/archive'  => 'cases#archive'
post '/cases/:id/unarchive' => 'cases#unarchive'
```

### Tests (3 new files)

- `test/controllers/scorers_controller_test.rb` — 271 lines
- `test/controllers/teams_controller_test.rb` — 94 lines
- `test/helpers/avatar_helper_test.rb` — 95 lines

### Documentation (1 new file)

- `docs/port/admin_scorer_editing.md` — Documents how admins edit communal scorers, including historical context about the removal of the separate admin interface

---

## Modified Files (Key Changes)

### Navigation & Layout
- `_header.html.erb` / `_header_core_app.html.erb` / `_sidebar.html.erb` — Updated links to point to new Rails routes instead of AngularJS routes

### Existing Controllers (minor cleanup)
- Multiple controllers had unused `before_action` lines or helper includes removed (e.g., `accounts_controller.rb`, `ai_judges_controller.rb`, `books_controller.rb`, `core_controller.rb`, etc.)

### Search Endpoints
- `search_endpoints/index.html.erb` — Significant rework (~47 lines changed) to support archive/unarchive inline

### Books
- `books/_book.html.erb` — Updated sharing icon to use embedded SVG instead of AngularJS directive
- `books/index.html.erb` — Added sharing modal include

### CSS
- `bootstrap5-add.css` — New styles added
- `bootstrap3-add.css` / `core.css` — Minor removals

### Build
- `build_css.js` — Updated to reflect removed CSS files

### Analytics
- `analytics/ahoy/events.rb` — New team-related event tracking
- `analytics/tracker/team.rb` — New team tracker methods

### Test Fixtures
- `test/fixtures/users.yml` — Significantly reworked (~37 lines changed)

---

## Current Architecture

The migration is complete. The codebase now uses:

- **37 ViewComponents** (`app/components/`) — Server-rendered UI components
- **60 Stimulus controllers** (`app/javascript/controllers/`) — Client-side interactivity
- **Rails controllers** — Server-side request handling and rendering
- **Turbo** — For dynamic page updates and navigation
- **Modern layout** — `core_modern.html.erb` for the workspace, standard Rails layouts elsewhere

All AngularJS code has been removed. The only remaining file from the Angular era is `app/assets/javascripts/mode-json.js` (ACE editor JSON mode), which is an orphaned file that can be safely deleted as it's no longer referenced anywhere in the codebase.
