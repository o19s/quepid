# App Structure

This document explains how the app is organized.

## Backend

The backend is written in Ruby using the Ruby on Rails framework.

Most of the backend is comprised of API endpoints with the exception of the admin area and user account or password management section.

The admin section contains a few pages for admins to manage users and default scorers.

The user account and password section are a few pages for the user to set or reset their own password and update their own info.

The API endpoints all live under the `app/controllers/api` folder. The API is versioned, even though there's only one version at the moment: `V1`.

## Frontend

The Frontend is built in two different ways.  Much of the application is standard Rails views that are rendered on the server.   However, the "core" of the application is a rich JavaScript app that runs in the browser.

### Core Frontend App

The case workspace is a [Stimulus](https://stimulus.hotwired.dev/) application served at `GET /case/:id(/try/:try_number)`, handled by `CoreController#index` using the `core` layout and views under `app/views/core/`.

- **Stimulus controllers** live under `app/javascript/controllers/`
- **Shared modules** and importmap pins live under `app/javascript/modules/` (see `config/importmap.rb`)
- **Server-rendered partials** in `app/views/core/` provide the HTML shell that Stimulus controllers enhance

## Long running/async processes

We have a number of long running processes, like exporting/importing files, running a Case, or judging a Book with a LLM.  In all of these we use ActiveJob, which lets us run processes in the background.   The state is stored in the database via SolidQueue.   Websockets are used to communicate with the front end.

## HTTPS / HTTP

Quepid runs on HTTPS where possible, however interacting via JSONP with Solr means that if Solr is under HTTP, then the Quepid page needs to be under HTTP as well.   We configure `ssl_options` to ensure that Quepid is under HTTPS for all pages except the main `/` or `CoreController` page, which is HTTP.
