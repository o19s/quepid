# Quepid Developer Guide

This guide provides detailed instructions for developers who want to set up, run, test, and contribute to Quepid.

## Table of Contents

<!-- MarkdownTOC levels="1,2,3,4" autolink=true bracket=round -->

- [Quepid Developer Guide](#quepid-developer-guide)
	- [Table of Contents](#table-of-contents)
- [Development Setup](#development-setup)
	- [I. Setting up Quepid to do Development](#i-setting-up-quepid-to-do-development)
		- [Docker Based Setup](#docker-based-setup)
			- [1. Prerequisites](#1-prerequisites)
			- [2. Setup your environment](#2-setup-your-environment)
			- [3. Initialize the database (First-time setup only)](#3-initialize-the-database-first-time-setup-only)
			- [4. Running the app](#4-running-the-app)
		- [Local Setup](#local-setup)
			- [Prerequisites](#prerequisites)
			- [Database Setup](#database-setup)
			- [Application Setup](#application-setup)
			- [Running the Application](#running-the-application)
			- [Running Tests](#running-tests)
		- [Large Sample Data for Quepid](#large-sample-data-for-quepid)
		- [Developing Jupyter notebooks](#developing-jupyter-notebooks)
	- [II. Development Log](#ii-development-log)
	- [III. Run Tests](#iii-run-tests)
		- [Minitest](#minitest)
		- [Pre-commit hooks](#pre-commit-hooks)
		- [JS Lint](#js-lint)
		- [CSS Lint](#css-lint)
		- [Karma](#karma)
		- [Playwright E2E](#playwright-e2e)
		- [Rubocop](#rubocop)
		- [All Tests](#all-tests)
		- [Performance Testing](#performance-testing)
		- [Notebook Testing](#notebook-testing)
	- [IV. Debugging](#iv-debugging)
		- [Debugging Ruby](#debugging-ruby)
		- [Debugging JS](#debugging-js)
		- [Debugging Splainer and other NPM packages](#debugging-splainer-and-other-npm-packages)
			- [Working with Local Splainer-Search](#working-with-local-splainer-search)
	- [Convenience Scripts](#convenience-scripts)
		- [Rake](#rake)
		- [Thor](#thor)
- [Elasticsearch](#elasticsearch)
- [Dev Errata](#dev-errata)
	- [How to use a new Node module or update an existing one](#how-to-use-a-new-node-module-or-update-an-existing-one)
	- [How to update Quepid's dependencies (Ruby, Gems, Yarn, Importmap)](#how-to-update-quepids-dependencies-ruby-gems-yarn-importmap)
	- [How to use a new Ruby Gem or update an existing one](#how-to-use-a-new-ruby-gem-or-update-an-existing-one)
	- [How to test nesting Quepid under a domain](#how-to-test-nesting-quepid-under-a-domain)
	- [How to run and test a local production build](#how-to-run-and-test-a-local-production-build)
	- [How to test SSL](#how-to-test-ssl)
	- [How to test OpenID Auth](#how-to-test-openid-auth)
	- [How to use the latest unreleased version via Docker](#how-to-use-the-latest-unreleased-version-via-docker)
	- [Modifying the database](#modifying-the-database)
	- [Updating RubyGems](#updating-rubygems)
	- [How does the Frontend work?](#how-does-the-frontend-work)
		- [Stimulus HTTP conventions](#stimulus-http-conventions)
		- [AngularJS code comments](#angularjs-code-comments)
	- [Fonts](#fonts)
	- [How to develop Jupyterlite](#how-to-develop-jupyterlite)
	- [How do Personal Access Tokens work?](#how-do-personal-access-tokens-work)
- [Troubleshooting](#troubleshooting)
	- [Docker Issues](#docker-issues)
		- [Docker Container Won't Start](#docker-container-wont-start)
		- [Slow Docker Performance](#slow-docker-performance)
	- [Database Issues](#database-issues)
		- [Choosing a database adapter](#choosing-a-database-adapter)
		- [Database Connection Errors](#database-connection-errors)
		- [Migration Errors](#migration-errors)
	- [Frontend Issues](#frontend-issues)
		- [Asset Compilation Errors](#asset-compilation-errors)
		- [Angular App Not Loading](#angular-app-not-loading)
	- [Testing Issues](#testing-issues)
		- [Tests Failing Unexpectedly](#tests-failing-unexpectedly)
		- [Karma Tests Timeout](#karma-tests-timeout)
- [QA](#qa)
	- [Seed Data](#seed-data)

<!-- /MarkdownTOC -->


# Development Setup

## I. Setting up Quepid to do Development

Historically Quepid development has REQUIRED Docker, which avoids having to deal with installing dependencies like Ruby and MySQL. However, we recently made some tweaks so you can do development without using Docker, which may fit some folks much better.

Quepid supports two database adapters: **SQLite** (the default - no separate database server to install or run) and **MySQL** (what production deployments use). Set `DB_ADAPTER=mysql2` in your `.env` file (or export it before running `bin/docker`/`bin/rails` commands) to opt into MySQL instead; leave it unset to use SQLite. See [Choosing a database adapter](#choosing-a-database-adapter) below.

### Docker Based Setup

Gives you preset up Ollama and a simple model for LLM as Judge testing.
Gives you a preset up proxy for http and https testing.

#### 1. Prerequisites

Make sure you have installed Docker.

#### 2. Setup your environment

Open up a local terminal.

Run the Bash based setup script to setup your Docker images:

```bash
bin/setup_docker
```

#### 3. Initialize the database (First-time setup only)

For first-time Docker users, you need to create and seed the initial database structure. Run this command:

```bash
docker compose run --rm app bin/rails db:setup
```

#### 4. Running the app

Now fire up Quepid locally at http://localhost:

```bash
bin/docker server
```

It can take up to a minute for the server to respond as it compiles all the front end assets on the first call.

We've created a helper script to run and manage the app through docker that wraps around the `docker-compose` command. You will need Ruby installed.
You can still use `docker compose` directly, but for the basic stuff you can use the following:

* Start the app: `bin/docker server` or `bin/docker s`
* Connect to the app container with bash: `bin/docker bash` or `bin/docker b`
* Connect to the Rails console: `bin/docker console` or `bin/docker c`
* Run any command: `bin/docker run [COMMAND]` or `bin/docker r [COMMAND]`
* Run dev mode as daemon: `bin/docker daemon` or `bin/docker q`
* Destroy the Docker env: `bin/docker destroy` or `bin/docker d`
* Run front end unit tests: `bin/docker r rails test:vitest` (Vitest) or `bin/docker r rails test:frontend` (Vitest + Karma + linters)
* Run back end unit tests: `bin/docker r rails test`

### Local Setup

This approach lets you run Quepid directly on your machine without Docker. It provides a more native development experience but requires setting up dependencies manually.  It may be faster to work with!

#### Prerequisites

1. **Ruby**: Check `.ruby-version` for the current version of Ruby.  We track the latest releases.  We recommend using a version manager like [rbenv](https://github.com/rbenv/rbenv) or [RVM](https://rvm.io/).

2. **Node.js**: Install Node.js 22.x or later.

3. **Yarn**: Install Yarn package manager.

4. **Database** (optional): By default Quepid uses SQLite, which needs no separate server or install - the `sqlite3` gem is enough. If you want to run against MySQL instead (matching production), install MySQL 8.0+ and set `DB_ADAPTER=mysql2` in your `.env` file.

#### Database Setup

With the default SQLite adapter, there's nothing to start up separately - `bin/setup` (below) creates `storage/development.sqlite3` for you.

If you set `DB_ADAPTER=mysql2`, start up MySQL however you like first (some folks set up just the `mysql` container with `docker compose up -d mysql` and run everything else locally).


#### Application Setup

1. Install Ruby dependencies:

```bash
bundle install
```

2. Set up the application:

```bash
bin/setup
```

If you're using `DB_ADAPTER=mysql2`, we assume a `root` database user with the password `password`.  If your password is different you will need to edit the `.env` file created after running the setup steps.

This will install node and yarn, set up the database, run migrations, and seed initial data and then start Rails.

#### Running the Application

Start the development server:

```bash
bin/dev
```

This will start the Rails server, asset compilation, and any other required processes. Visit http://localhost:3000 to access Quepid.

#### Running Tests

Run the test suite:

```bash
bin/rails test                # Run backend tests
bin/rails test:vitest         # Vitest (app/javascript)
bin/rails test:frontend       # Vitest + Karma + linters
bundle exec rubocop           # Run Ruby linter
```

As you read through the rest of this guide, just ignore the `bin/docker r` part of the commands! Feedback welcome 🙏.

### Large Sample Data for Quepid
If you want to create some cases that have 100's and 1000's of queries, then do:

```bash
 bin/docker r bundle exec thor sample_data:large_data
```

or

```bash
 bundle exec thor sample_data:large_data
```

Solr requests are retried with backoff when the remote Solr is slow or returns 5xx/429.

This is useful for stress testing Quepid! Especially the front end application!

### Developing Jupyter notebooks

Jupyter notebooks and the Jupyterlite ecosystem are maintained in https://github.com/o19s/quepid-jupyterlite.

To run the Jupyter notebooks for development, you need to run:

```bash
bin/setup_jupyterlite_docker
```

or 

```bash
bin/setup_jupyterlite
```

## II. Development Log

While running the app under foreman, you'll only see a request log, for more detailed logging run the following:

```bash
tail -f log/development.log
```

## III. Run Tests

There are three types of tests that you can run:

### Minitest

These tests run the tests from the Rails side (mainly API controllers, and models):

```bash
bin/docker r rails test
```

Run a single test file via:

```bash
bin/docker r rails test test/models/user_test.rb
```

Or even a single test in a test file by passing in the line number!

```bash
bin/docker r rails test test/models/user_test.rb:33
```

If you need to reset your test database setup then run:

```bash
bin/docker r bin/rake db:drop RAILS_ENV=test
bin/docker r bin/rake db:create RAILS_ENV=test
```

View the logs generated during testing set `config.log_level = :debug` in `test.rb`
and then tail the log file via:

```bash
tail -f log/test.log
```

### Pre-commit hooks

Git commits run RuboCop (Ruby), JSHint (`app/assets/javascripts/`), ESLint on the modern `app/javascript/` tree, and Prettier on `app/javascript/api/` and `utils/` only — via a version-controlled hook in `.githooks/pre-commit`. No extra tooling is required beyond what the project already uses (Bundler/RuboCop and Yarn).

Hooks prefer Docker when it is available (`bin/docker r`), matching the usual Quepid development workflow.

Enable hooks:

```bash
bin/install-git-hooks
```

`bin/setup` and `bin/setup_docker` call `bin/install-git-hooks` automatically.

Run the hook manually against staged files:

```bash
.githooks/pre-commit
```

Run linters directly:

```bash
bin/pre-commit-rubocop path/to/file.rb
bin/pre-commit-jshint path/to/file.js
bin/eslint-staged path/to/app/javascript/file.js
bin/prettier-staged path/to/app/javascript/file.js
```

### JS Lint

**Legacy Angular assets** (`app/assets/javascripts/`) — JSHint:

```bash
bin/docker r rails test:jshint
```

**Modern importmap / Stimulus** (`app/javascript/`) — ESLint on the full modern tree; Prettier on `api/` and `utils/` only (see [`docs/js_tooling.md`](docs/js_tooling.md)):

```bash
bin/docker r yarn lint:js
bin/docker r yarn format:js:check    # Prettier check — api/ and utils/ only; or yarn format:js to fix
bin/docker r yarn test:unit          # Vitest (app/javascript)
bin/docker r rails test:vitest       # same as yarn test:unit
bin/docker r rails test:eslint       # ESLint + Prettier (CI-style)
```

**Vitest PR policy:** new or changed logic in `api/` or `utils/` → colocated `*.test.js` in the same PR. Controllers → test when you touch them for migration, not a blanket rewrite.

Git commits can run linters on staged JS via [pre-commit](https://pre-commit.com):

```bash
pip install pre-commit   # or: pipx install pre-commit
pre-commit install
```

The hook lints staged `*.js` under `app/assets/javascripts` (JSHint) and scoped files under `app/javascript` (ESLint on controllers/modules/etc.; Prettier on `api/` and `utils/` only). JSHint paths and skips match `rake test:jshint` — `lib/jshint/configuration.rb` excludes `vendor/assets/javascripts` and `lib/assets/javascripts` from the default search paths. Lint/format scope is in `config/javascript_lint_scope.mjs` and [`docs/js_tooling.md`](docs/js_tooling.md). Requires `yarn install` on the host so `node_modules` exists. Re-run `pre-commit install` after cloning or pulling hook changes.

### CSS Lint

To lint first-party stylesheets in `app/assets/stylesheets`:

```bash
bin/docker r yarn lint:css
# or
bin/docker r rails test:stylelint
```

Configuration lives in `.stylelintrc.json` (extends `stylelint-config-standard` with pragmatic overrides for legacy Quepid CSS). Built bundles under `app/assets/builds/` and vendored CSS are ignored (see `.stylelintignore`).

Pre-commit can lint staged CSS the same way as JSHint:

```bash
pre-commit install
```

The `stylelint-staged` hook only runs on `app/assets/stylesheets/*.css`. Requires `yarn install` so `node_modules/stylelint` exists.

### Karma

Runs tests for the Angular side. There are two modes for the karma tests:

* Single run: `bin/docker r rails karma:run`
* Continuous/watched run: `bin/docker r bin/rake karma:start`

**Note:** The karma tests require the assets to be precompiled, which adds a significant amount of time to the test run.
If you are only making changes to the test/spec files, then it is recommended you run the tests in watch mode (`bin/docker r bin/rake karma:start`).
The caveat is that any time you make a change to the app files, you will have to restart the process (or use the single run mode).

### Playwright E2E

Golden-path and visual-regression tests against a running app, under `test/playwright/`. Unlike Karma, these hit real HTTP and a real browser, so the app must already be up (`bin/docker s`) before running them.

```bash
bin/docker r yarn test:e2e             # run the suite
bin/docker r yarn test:e2e:ui          # Playwright's interactive UI runner
bin/docker r yarn test:e2e:update-baselines   # regenerate baseline screenshots
```

One-time setup: the Playwright browser binaries aren't part of `node_modules` and don't ship in the app image, so install them once (they only need to be reinstalled if `@playwright/test`'s version changes):

```bash
bin/docker r npx playwright install chromium
```

Environment variables (all optional, sensible defaults baked in):

* `QUEPID_BASE_URL` — defaults to `http://localhost:33000` (`docker-compose`'s published port). Override for a different host/port, e.g. `QUEPID_BASE_URL=http://localhost:3000` if your setup exposes the app there directly instead of through nginx.
* `QUEPID_E2E_EMAIL` / `QUEPID_E2E_PASSWORD` — sign-in credentials used by `auth.setup.ts`, default to the same sandbox login CLAUDE.md documents for the Playwright MCP flow (`quepid+realisticactivity@o19s.com` / `password`). The resulting session is cached at `test/playwright/.auth/user.json` (gitignored).
* `QUEPID_E2E_CASE_ID` — the case ID the suite navigates to for all case-page specs, defaults to `1`. **Must be a case with queries** — if your seed data's case 1 has none, the shared `gotoCase()` helper (`test/playwright/angular_case_helpers.ts`) times out waiting for the query list to render, and every case-page spec fails. Override with an ID from your own seed data, e.g. `QUEPID_E2E_CASE_ID=5`.

Structure:

* `core_smoke.spec.ts`, `angular_pages.spec.ts`, `angular_pages_narrow_viewport.spec.ts` — golden-path interaction screenshots (`toHaveScreenshot`) across modals, dropdowns, and the wizard, at desktop and narrow viewports.
* `stimulus_pages.spec.ts` — smoke and interaction tests for Stimulus pages (cases import modal redirect, bulk judgement save via routed API, mapper wizard) on the `application` layout.
* `popover_visibility.spec.ts` — computed-style assertions catching invisible-but-present popovers (see the BS5-on-`core` traps documented in CLAUDE.md).
* `modal_a11y.spec.ts` — axe accessibility smoke test on a modal.
* `case_header_typography.spec.ts` — a non-screenshot, computed-style assertion.

Baseline screenshots live under `test/playwright/baselines/` and **are checked into git** (unlike `test/playwright/test-results/` and `playwright-report/`, which are runtime output and gitignored) — a missing baseline fails its test with "no baseline found" rather than silently passing. When you add a new `toHaveScreenshot()` call or intentionally change a screen's appearance, run `test:e2e:update-baselines` and `git add` the resulting PNGs.

Tests run serially (`workers: 1`, `fullyParallel: false` in `playwright.config.ts`) because they share case state in the database (whichever adapter the dev server is running against) and a single authenticated session — don't assume they're safe to parallelize without addressing that first.

### Rubocop

To check the Ruby syntax:

```bash
bin/docker r bundle exec rubocop
```

Rubocop can often autocorrect many of the lint issues it runs into via `--autocorrect-all`:

```bash
bin/docker r bundle exec rubocop --autocorrect-all
```

If there is a new "Cop" as they call their rules that we don't like, you can add it to the `./rubocop.yml` file.

### All Tests

If you want to run all of the tests in one go (before you commit and push for example), just run these two commands:

```bash
bin/docker r rails test
bin/docker r rails test:vitest
bin/docker r rails test:frontend
```

For some reason we can't run both with one command, _though we should be able to!_.

### Performance Testing

If you want to create a LOT of queries for a user for testing, then run

```bash
bin/docker r bundle exec thor sample_data:large_data
```

You will have two users, `quepid+100sOfQueries@o19s.com` and `quepid+1000sOfQueries@o19s.com` to test with.

### Notebook Testing

If you want to test the Jupyterlite notebooks, or work with a "real" case and book, then run

```bash
bin/docker r bundle exec thor sample_data:haystack_party
```

You will have lots of user data from the Haystack rating party book and case to work with. This data is sourced from the public case https://go.quepidapp.com/case/6789/try/12?sort=default and https://go.quepidapp.com/books/25

## IV. Debugging

### Debugging Ruby

Debugging ruby usually depends on the situation, the simplest way is to print out the object to the STDOUT:

```ruby
puts object         # Prints out the .to_s method of the object
puts object.inspect # Inspects the object and prints it out (includes the attributes)
pp object           # Pretty Prints the inspected object (like .inspect but better)
```

In the Rails application you can use the logger for the output:

```ruby
Rails.logger object.inspect
```

If that's not enough and you want to run a debugger, the `debug` gem is included for that.
See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem.

Also, we have the `derailed` gem available which helps you understand memory issues.

```bash
bin/docker r bundle exec derailed bundle:mem
```

### Debugging JS

While running the application, you can debug the JavaScript using your favorite tool, the way you've always done it.

The JavaScript files will be concatenated into one file, using the rails asset pipeline.

You can turn that off by toggling the following flag in `config/environments/development.rb`:

```ruby
# config.assets.debug = true
config.assets.debug = false
```

to

```ruby
config.assets.debug = true
# config.assets.debug = false
```

Because there are too many Angular JS files in this application, and in `debug` mode Rails will try to load every file separately, that slows down the application, and becomes really annoying in development mode to wait for the scripts to load. Which is why it is turned off by default.

**PS:** Don't forget to restart the server when you change the config.

Also please note that the files `secure.js`, `application.js`, and `admin.js` are used to load all the
JavaScript and CSS dependencies via the Rails Asset pipeline. If you are debugging Bootstrap, then
you will want individual files. So replace `//= require sprockets` with `//= require bootstrap-sprockets`.

### Debugging Splainer and other NPM packages

`docker-compose.override.yml.example` can be copied to `docker-compose.override.yml` and use it to override environment variables or work with a local copy of the splainer-search JS library during development defined in `docker-compose.yml`. Example is included. Just update the path to `splainer-search` with your local checkout! https://docs.docker.com/compose/extends/

#### Working with Local Splainer-Search

When developing Quepid alongside changes to `splainer-search`, you can mount your local splainer-search files into the Docker container. Here's how:

1. **Set up the override file**: Create or edit `docker-compose.override.yml` to mount your local splainer-search files:

2. **Restart Docker containers**: After creating or modifying `docker-compose.override.yml`:

   ```bash
   bin/docker s
   ```

3. **After splainer changes**: **splainer-search 3.x** is installed under **`node_modules/splainer-search`** and pulled into the bundle via `app/javascript/angular_app.js` and **`splainer_search_adapter.js`**.

   With **`bin/docker s`**, Foreman rebuilds the AngularJS bundles when you save; **hard-refresh** the case page.

   Manual rebuild only if watchers are not running:

   ```bash
   bin/docker r yarn build:angular
   ```

   Then refresh your browser to see the changes.

4. **Why bundles work this way**
   - Splainer-search ESM modules are inlined into **`app/assets/builds/angular_app.js`** at build time, not runtime (`splainer_search_adapter.js` registers wired singletons on the legacy Angular module **`o19s.splainer-search`** so existing DI keeps working).
   - The vendor bundle also inlines npm **Bootstrap 5** JS (for `quepidPopover`, `quepidTooltip`, `quepidModalSvc`, etc.).
   - Vendored widget CSS (`angular-wizard`, `ng-json-explorer`, `ng-tags-input`) is copied into **`app/assets/builds/`** by **`yarn build:css`** (`build_css.js` → `copyVendorFiles()`), not by **`build:angular-vendor`**
   - With **`bin/docker s`**, Foreman watches the vendor import graph (including **`node_modules/splainer-search`**) and keeps **`angular_app.js`** + **`quepid_angular_app.js`** in sync. Save edits and hard-refresh. Run **`yarn build:angular`** only if watchers are not running (that script runs both bundles).


## Convenience Scripts

This application has two ways of running scripts: `rake` & `thor`.

Additionally, there are some Docker-specific convenience scripts in the `bin/` directory:

- `bin/docker` - Wrapper for common Docker Compose operations (see `bin/docker` for usage)
- `bin/setup_docker` - Initial Docker environment setup

Rake is great for simple tasks that depend on the application environment, and default tasks that come by default with Rails.

Whereas Thor is a more powerful tool for writing scripts that take in args much more nicely than Rake.

### Rake

To see what rake tasks are available run:

```bash
bin/docker r bin/rake -T
```

**Note**: the use of `bin/rake` makes sure that the version of `rake` that is running is the one locked to the app's `Gemfile.lock` (to avoid conflicts with other versions that might be installed on your system). This is equivalent of `bundle exec rake`.

Common rake tasks that you might use:

```bash
# db
bin/docker r bin/rake db:create
bin/docker r bin/rake db:drop
bin/docker r bin/rake db:migrate
bin/docker r bin/rake db:rollback
bin/docker r bin/rake db:schema:load
bin/docker r bin/rake db:seed
bin/docker r bin/rake db:setup

# show routes
bin/docker r bin/rails routes

# tests
bin/docker r rails test
bin/docker r rails test:vitest
bin/docker r rails test:frontend
bin/docker r bin/rake test:jshint
bin/docker r rails test:eslint
bin/docker r bin/rake test:stylelint
```

### Thor

To see available tasks:

```bash
bin/docker r bundle exec thor list
```

Additional documentation is in [Operating Documentation](docs/operating_documentation.md#scripting-users-cases-ratings).

# Elasticsearch

You will need to configure Elasticsearch to accept requests from the browser using [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing). To enable CORS, add the following to elasticsearch's config file. Usually, this file is located near the elasticsearch executable at `config/elasticsearch.yml`.

```yaml
http.cors:
  enabled: true
  allow-origin: /https?:\/\/localhost(:[0-9]+)?/
```

See more details on the wiki at https://github.com/o19s/quepid/wiki/Troubleshooting-Elasticsearch-and-Quepid

# Dev Errata

## How to use a new Node module or update an existing one

Typically you would simply do:

```bash
bin/docker r yarn add foobar
```

or

```bash
bin/docker r yarn upgrade foobar
```

which will install/upgrade the Node module, and then save that dependency to `package.json`.

Then check in the updated `package.json` and `yarn.lock` files.

Use `bin/docker r yarn outdated` to see what packages you can update!!!!

## How to update Quepid's dependencies (Ruby, Gems, Yarn, Importmap)

Rough checklist for a general dependency-update pass:

1. Bump the Ruby version in `.ruby-version`, `Gemfile`, `.circleci/config.yml`, `Dockerfile.dev`, and `Dockerfile.prod`, then rebuild: `bin/setup_docker` and `bin/docker s`.
2. Update Ruby gems: `bin/docker r bundle outdated --groups`, then `bin/docker r bundle update <gem>` for what's behind.
3. Update yarn packages: `bin/docker r yarn outdated`, then `bin/docker r yarn upgrade <package>`.
4. Update importmap-pinned JS packages: `bin/docker r bundle exec bin/importmap outdated`, then `bin/docker r bundle exec bin/importmap update`.
5. Sanity-check in a browser (e.g. via Playwright MCP): sign in, check the console for new errors, and exercise anything visibly affected by the bump before committing.
6. If `renovate.json`'s grouping/custom-manager rules for these dependencies (Ruby version, Rails packages, Docker Node/Yarn ARGs) no longer match, update it too, so future bumps keep arriving as sane grouped PRs.

## How to use a new Ruby Gem or update an existing one

Typically you would simply do:

```bash
bin/docker r bundle add foobar
```

which will install the new Gem, and then save that dependency to `Gemfile`.

You can also upgrade a gem that doesn't have a specific version in `Gemfile` via:

```bash
bin/docker r bundle update foobar
```

You can remove a gem via:

```bash
bin/docker r bundle remove foobar
```

Then check in the updated `Gemfile` and `Gemfile.lock` files. For good measure
run the `bin/setup_docker`.

To understand if you have gems that are out of date run:

```bash
bin/docker r bundle outdated --groups
```

## How to test nesting Quepid under a domain

Uncomment in `docker-compose.yml` the setting `- RAILS_RELATIVE_URL_ROOT=/quepid-app` and then open http://localhost:3000/quepid-app.

## How to run and test a local production build

These steps should get you up and running locally with a production build (versus the developer build)
of Quepid.

1. Make the desired changes to the code

2. From the root dir in the project run the following to build a new docker image:
```bash
docker build -t o19s/quepid -f Dockerfile.prod .
```
This could error on first run. Try again if that happens

3. Tag a new version of your image.
   You can either hard code your version or use a sys var for it (like QUEPID_VERSION=10.0.0) or if you prefer use 'latest'
```bash
docker tag o19s/quepid o19s/quepid:$QUEPID_VERSION
```

4. Bring up the mysql container
```bash
docker compose up -d mysql
```

5. Run the initialization scripts. This can take a few seconds
```bash
docker compose run --rm app bin/rake db:setup
```

6. Update your docker-compose.prod.yml file to use your image by updating the image version in the app 
```yaml
image: o19s/quepid:10.0.0
```

7. Start up the app either as a Daemon (-d) or as an active container
```bash
docker compose up [-d]
```

8. You should be able to access the app through [http://localhost](http://localhost)

## How to test SSL

There's a directory `.ssl` that contains they key and cert files used for SSL. This is a self signed generated certificate for use in development ONLY!

The key/cert were generated using the following command:

```bash
openssl req -new -newkey rsa:2048 -sha1 -days 365 -nodes -x509 -keyout .ssl/localhost.key -out .ssl/localhost.crt
```

**PS:** It is not necessary to do that again.

The `docker-compose.yml` file contains an nginx reverse proxy that uses these certificates. You can access Quepid at https://localhost or http://localhost. (Quepid will still be available over http on port 80.)

## How to test OpenID Auth

Quepid supports OpenID Connect (OIDC) authentication. To test this functionality in development:

1. **Setup a Hosts entry**
   There is a redirect to http://keycloak that we need to support.
   Edit `/etc/hosts` and add:
   ```
   # Needed by Quepid to make http://keycloak work everywhere!
   127.0.0.1       keycloak
   ```

2. **Configure the Keycloak Identity Provider**:

   The development environment includes a Keycloak container set up in the `docker-compose.yml` file. When running the development environment with Docker, Keycloak will be available at http://localhost:9080.

   - Default admin credentials: 
     - Username: `admin`
     - Password: `password`
     
The below steps are only if you want to customize the setup, and for basic testing you can skip.

3. **Configure Quepid for OIDC**:

   Set the following environment variables in your `.env` file or `docker-compose.override.yml`:

   ```env
   OPENID_CONNECT_ENABLED=true
   OPENID_CONNECT_ISSUER=http://localhost:9080/realms/quepid
   OPENID_CONNECT_DISCOVERY_ENDPOINT=/.well-known/openid-configuration
   OPENID_CONNECT_CLIENT_ID=quepid
   OPENID_CONNECT_CLIENT_SECRET=your_client_secret
   ```

4. **Set up a Realm and Client in Keycloak**:

   - Log in to the Keycloak Admin console
   - Create a new realm named `quepid` (or use an existing one)
   - Create a new client with:
     - Client ID: `quepid`
     - Client Protocol: `openid-connect`
     - Access Type: `confidential`
     - Valid Redirect URIs: `http://localhost:3000/*` and `http://localhost/*`
   - Get the client secret from the Credentials tab and update your configuration

4. **Create Test Users**:

   - In the Keycloak Admin console, go to Users
   - Add users with email addresses and passwords
   - Assign appropriate roles

5. **Test the Integration**:

   Restart Quepid and you should see an "OpenID Connect" button on the login page. 
   When clicked, it will redirect you to the Keycloak login page.

For production deployments, you would typically configure Quepid to use your organization's existing OIDC provider (like Okta, Auth0, Azure AD, etc.) rather than Keycloak.

## How to use the latest unreleased version via Docker

There is a nightly build of the latest Quepid pushed to DockerHub, just use the tag `quepid:nightly`.

## Modifying the database

Here is an example of generating a migration:

```bash
bin/docker r bundle exec bin/rails g migration FixCuratorVariablesTriesForeignKeyName
```

Followed by `bin/docker r bundle exec rake db:migrate`

You should also update the schema annotation data by running `bin/docker r bundle exec annotations`
when you change the schema.

You can rebuild the [ERD](docs/erd.png) (embedded in the [Data Mapping](docs/data_mapping.md) doc) via
`bin/docker r bundle exec rake erd:image`

## Updating RubyGems

Modify the file `Gemfile` and then run:

```bash
bin/docker r bundle install
```

You will see a updated `Gemfile.lock`, go ahead and check it and `Gemfile` into Git.

## How does the Frontend work?

We use Angular 1 for the core interactive application. **`splainer-search`** is **`3.x` from npm** (see root `package.json`); **`app/javascript/splainer_search_adapter.js`** registers the wired singletons on the legacy Angular module **`o19s.splainer-search`** so existing DI (`fieldSpecSvc`, `searchSvc`, …) keeps working. Most other AngularJS-era UI libraries (wizard, pagination, ui-ace, `ng-tags-input`, etc.) remain **under `app/javascript/vendor/`** (see `vendor/README.md`). Only **`angular`**, **`splainer-search`**, and shared utilities (Bootstrap, autocompleter, ...) are npm dependencies for the core Case UI bundle. Esbuild bundles from **`app/javascript/angular_app.js`**.  
The Angular **`core`** UI loads a built **`core.css`** bundle: npm **Bootstrap 5** plus Quepid sheets (`core-additions.css`, **`bootstrap5-compat.css`**, and screen CSS), wired in **`build_css.js`** (`buildCoreCSS()`). The historical **`bootstrap3-add.css`** navbar slice has been consolidated into **`bootstrap5-compat.css`**.

For the rest of Quepid, we use Bootstrap 5 via npm; the non-Angular UI loads it through `app/javascript/application_modern.js` (importmap). Assets use **Propshaft** and **jsbundling-rails** (esbuild for the Angular core bundle and CSS).

### Stimulus HTTP conventions

Normative patterns for **new** client code on Rails pages (teams, books, admin, …). Legacy Angular patterns on `/case/...` live in [`docs/todo/angularjs_removal_inventory.md`](docs/todo/angularjs_removal_inventory.md#angular-core-http-patterns-legacy).

- **Server owns URLs.** Pass Rails path helpers or `url_for` into Stimulus as `data-*-url-value` attributes (see `mapper_wizards/show.html.erb`, `mapper_wizard_controller.js`). For forms, use `this.formTarget.action` (`import_case_controller.js`). Never hardcode `/` or absolute site-root paths for navigation.
- **CSRF on mutating requests.** Layouts include `csrf_meta_tags`. Use `apiFetch` from `app/javascript/api/fetch.js` (importmap: `api/fetch`) so `X-CSRF-Token` is added automatically. For form submits (e.g. `confirm_delete_controller.js`), use `authenticity_token` instead.
- **`fetch` shape:** `POST`/`PUT`/`DELETE` with `Content-Type: application/json`, the CSRF header, and `JSON.stringify` body. Check `response.ok`; on failure, parse JSON with `.catch(() => ({}))` before surfacing `data.message`, `data.error`, or `response.statusText`.
- **REST vs HTML routes.** JSON under `/api/...` is the REST surface ([OpenAPI](/api/docs), [`docs/QUEPID_FEATURES.md` §23](docs/QUEPID_FEATURES.md#23-api-surface)). Some Stimulus controllers hit **HTML JSON endpoints** instead (bulk judge, mapper wizard) — still prefer server-generated URLs over paths built in JS.
- **Subpath deployments.** Layouts set `data-quepid-root-url` on `<body>` via `quepid_root_url`. Use `getQuepidRootUrl()` from `utils/quepid_root` only when navigation cannot be a server-rendered URL (e.g. redirect after import). Prefer `data-*-url-value` for API endpoints.

## Fonts

The *aller* font face is from FontSquirrel, and the .ttf is converted into .woff2 format.  

## How to develop Jupyterlite

Run the `./bin/setup_jupyterlite` to update the archive file `./jupyterlite/notebooks.gz`. This
also sets up the static files in the `./public/notebooks` directory. However, so that we don't check in hundreds of files,
we ignore that directory from Github. At `asset:precompile` time we unpack the `./jupyterlite/notebooks.gz` file instead.
This works on Heroku and the production Docker image.

To update the Jupyterlite version, change the release URL in `Dockerfile.prod` or run `./bin/setup_jupyterlite` locally to pull a new release.

Yes, Jupyterlite works in localhost. After running `./bin/setup_jupyterlite`, you can access the notebooks by navigating to http://localhost:3000/notebooks/ when running your local development server. Jupyterlite runs entirely in the browser, so it works the same way in development as it does in production.

## How do Personal Access Tokens work?

See this great blog post: https://keygen.sh/blog/how-to-implement-api-key-authentication-in-rails-without-devise/.

# Troubleshooting

This section covers common issues you might encounter during development and how to resolve them.

## Docker Issues

### Docker Container Won't Start

**Symptom**: `bin/docker server` fails to start or containers exit immediately.

**Solutions**:
1. Check if ports are already in use:
   ```bash
   lsof -i :3000
   ```
   Kill any processes using the required ports.

2. Check Docker logs:
   ```bash
   docker compose logs app
   ```

3. Reset Docker environment:
   ```bash
   bin/docker destroy
   bin/setup_docker
   ```

### Slow Docker Performance

**Symptom**: Development in Docker is running very slowly.

**Solutions**:
1. Increase resources allocated to Docker in Docker Desktop preferences
2. Check for large log files that might be slowing down volume mounts
3. Prune unused Docker resources:
   ```bash
   docker system prune -a
   ```

## Database Issues

### Choosing a database adapter

Quepid defaults to **SQLite** (`storage/development.sqlite3` / `storage/test.sqlite3`) - nothing to start up separately. Set `DB_ADAPTER=mysql2` in `.env` (or export it before running `bin/docker`/`bin/rails` commands) to use MySQL instead, which is what production deployments run. Both are exercised in CI (`.github/workflows/test.yml`).

Known SQLite-specific behavior to be aware of:
- SQLite's default text comparison is already case-sensitive, matching the case-sensitive collation MySQL uses for `query_text` columns - no configuration needed.
- Solid Queue and Solid Cable both poll the same database file; under heavy concurrent local load you may occasionally see `SQLITE_BUSY` - `config/database.yml`'s `timeout:` setting gives busy connections a retry window before failing.
- `docker-compose.yml`'s `app` service still declares `depends_on: mysql`, so the `mysql` container starts (and Docker waits for it to be healthy) even when `DB_ADAPTER` is left at its `sqlite3` default. It's unused in that case, just an idle extra container - not a functional problem, but not the "zero extra infrastructure" experience SQLite is meant to give either. Making that dependency conditional (e.g. via Compose profiles) is a reasonable follow-up if it becomes annoying.
- A handful of tests that depend on MySQL-only behavior (e.g. VARCHAR length enforcement, which SQLite doesn't have) are skipped when running against SQLite - see `AdapterFunctions.mysql?` usage in `test/`.

### Database Connection Errors

**Symptom**: Rails can't connect to the database.

**Solutions**:
1. If using MySQL (`DB_ADAPTER=mysql2`), verify the container is running:
   ```bash
   docker compose ps mysql
   ```

2. Check database configuration:
   ```bash
   cat config/database.yml
   ```

3. Reset database:
   ```bash
   bin/docker r bin/rake db:drop db:create db:migrate db:seed
   ```

### Migration Errors

**Symptom**: Database migrations fail.

**Solutions**:
1. Check migration file for syntax errors
2. Try running migrations individually:
   ```bash
   bin/docker r bin/rake db:migrate:status
   bin/docker r bin/rake db:migrate:up VERSION=20230101000000
   ```

## Frontend Issues

### Asset Compilation Errors

**Symptom**: JavaScript or CSS assets fail to compile.

**Solutions**:
1. Check for JavaScript or CSS syntax errors:
   ```bash
   bin/docker r rails test:jshint
   bin/docker r rails test:stylelint
   ```

2. Clear asset cache:
   ```bash
   bin/docker r bin/rake assets:clobber
   bin/docker r bin/rake assets:precompile
   ```

3. Check Node.js and Yarn versions:
   ```bash
   bin/docker r node -v
   bin/docker r yarn -v
   ```

### Angular App Not Loading

**Symptom**: Quepid interface doesn't load properly.

**Solutions**:
1. Check browser console for errors
2. Clear browser cache and cookies
3. Verify that all JS dependencies are installed:
   ```bash
   bin/docker r yarn install
   ```

## Testing Issues

### Tests Failing Unexpectedly

**Symptom**: Tests that were previously passing are now failing.

**Solutions**:
1. Reset test database:
   ```bash
   bin/docker r bin/rake db:test:prepare
   ```

2. Check for changed fixtures or factory setups
3. Run tests with more verbosity:
   ```bash
   bin/docker r rails test -v
   ```

### Karma Tests Timeout

**Symptom**: Karma tests hang or timeout.

**Solutions**:
1. Run in single-run mode:
   ```bash
   bin/docker r rails karma:run
   ```

2. Check for browser compatibility issues
3. Increase the timeout in karma.conf.js

# QA

There is a code deployment pipeline to the http://quepid-staging.herokuapp.com site that
is run on successful commits to `main`.

If you have pending migrations you will need to run them via:

```bash
heroku run bin/rake db:migrate -a quepid-staging
heroku restart -a quepid-staging
```

## Seed Data

The following accounts are created through the `bin/setup_docker` process. They all follow the following format:

```text
email: quepid+[type]@o19s.com
password: password
```

where type is one of the following:

* `admin`: An admin account
* `realisticActivity`: A user with a various cases that demonstrate Quepid, including the Haystack Rating Party demo case and book and is a member of the 'OSC' team.
* `100sOfQueries`: A user with a Solr case that has 100s of queries (usually disabled)
* `1000sOfQueries`: A user with a Solr case that has 1000s of queries (usually disabled)
* `oscOwner`: A user who owns the team 'OSC'
* `oscMember`: A user who is a member of the team 'OSC'
