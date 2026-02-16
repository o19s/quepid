# App Structure

This document explains how the app is organized.

## Quick Reference
- Ruby on Rails
- AngularJS - Being retired
- Stimulus/Turbo - Being implemented
- ActiveJob
- SolidQueue
- WebSockets
- Boostrap

## Backend

The backend is written in Ruby using the Ruby on Rails framework.

Most of the backend is comprised of API endpoints with the exception of the admin area and user account or password management section.

The admin section contains a few pages for admins to manage users and default scorers.

The user account and password section are a few pages for the user to set or reset their own password and update their own info.

The API endpoints all live under the `app/controllers/api` folder. The API is versioned, even though there's only one version at the moment: `V1`.

## Frontend
The Frontend is built in two different ways.  Much of the application is standard Rails views that are rendered on the server.   However, the "core" of the application is a rich JavaScript app that runs in the browser.

For the migration from AngularJS to Stimulus and what remains to be done, see [De-Angular Migration Review](deangularjs_migration_review.md). A detailed migration checklist is in [Angular to Stimulus, Hotwire, and ViewComponents Checklist](angular_to_stimulus_hotwire_viewcomponents_checklist.md). ViewComponent usage is documented in [ViewComponent Conventions](view_component_conventions.md).

### Core Frontend App

The first place to look would be inside of the `app/assets/javascripts/components` directory. That directory has a bunch of sub-directories, each representing a component.

A component is comprised of a controller file typically ending with `_controller.js`, a directive file typically ending with `_directive.js` and a template file typically ending with `.html`. Some components may have multiple controllers and templates, especially the ones that have a modal associated with it.

If what you're looking for isn't a component (we haven't been able to refactor the entire frontend into components yet), it is then probably setup as a controller in `app/assets/javascripts/controllers` and an HTML template in `app/assets/templates`.

The AngularJS app starts with the `app/assets/javascripts/app.js` file and the `app/assets/javascripts/routes.js` file.

The main entry to the app is through a case page. The URL `/case/:id(/try/:try_number)` is served by **Rails** `CoreController#show` (see `config/routes.rb`, `app/controllers/core_controller.rb`). The show action renders the modern layout and view; it does not use Angular client-side routing. Legacy Angular entry was previously via `app/assets/javascripts/controllers/mainCtrl.js` and `routes.js` (case/try routes there have been removed).

**Modern stack (no Angular):** Layout `app/views/layouts/core_modern.html.erb` loads `application_modern.js` (Stimulus/Turbo) only. Use the Rails helper `quepid_root_url` (or in JS `document.body.dataset.quepidRootUrl` / the workspace Stimulus controller) for the app root URL instead of hardcoding `/`.

This is the basic structure of the app and should get you started.

## Long running/async processes
We have a number of long running processes, like exporting/importing files, running a Case, or judging a Book with a LLM.  In all of these we use ActiveJob, which lets us run processes in the background.   The state is stored in the database via SolidQueue.   Websockets are used to communicate with the front end.

## HTTPS / HTTP

Quepid runs on HTTPS where possible, however interacting via JSONP with Solr means that if Solr is under HTTP, then the Quepid page needs to be under HTTP as well.   We configure `ssl_options` to ensure that Quepid is under HTTPS for all pages except the main `/` or `CoreController` page, which is HTTP.

## Cursor / IDE Rules

Project-specific rules for Cursor live in `.cursor/rules/`. They cover: core project setup (Docker, yarn, docs, URLs), Ruby/Rails conventions, frontend migration (Stimulus, Turbo, ViewComponents), and legacy JavaScript/AngularJS. The "Quepid project" rule is always applied; others apply when editing matching file types.
