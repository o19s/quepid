# Quepid Developer Guide

This guide provides detailed instructions for developers who want to set up, run, test, and contribute to Quepid.

## Table of Contents

<!-- MarkdownTOC levels="1,2,3,4" autolink=true bracket=round -->

- [Development Setup](#development-setup)
  - [I. System Dependencies](#i-setting-up-quepid-to-do-development)
    - [Docker Based Setup](#docker-based-setup)
      - [1. Prerequisites](#1-prerequisites)
      - [2. Setup your environment](#2-setup-your-environment)
      - [3. Running the app](#3-running-the-app)
    - [Local Setup ](#local-setup)
      - [Prerequisites](#prerequisites)
      - [Database Setup](#database-setup)
      - [Application Setup](#application-setup)
      - [Running the Application](#running-the-application)
      - [Running Tests](#running-tests)
    - [Large Sample Data for Quepid](#large-sample-data-for-quepid)
    - [Developing Jupyter notebook](#developing-jupyter-notebook)
  - [II. Development Log](#ii-development-log)
  - [III. Run Tests](#iii-run-tests)
    - [Minitest](#minitest)
    - [JS Lint](#js-lint)
    - [Karma](#karma)
    - [Rubocop](#rubocop)
    - [All Tests](#all-tests)
    - [Performance Testing](#performance-testing)
    - [Notebook Testing](#notebook-testing)
  - [IV. Debugging](#iv-debugging)
    - [Debugging Ruby](#debugging-ruby)
    - [Debugging JS](#debugging-js)
    - [Debugging Splainer and other NPM packages](#debugging-splainer-and-other-npm-packages)
  - [Convenience Scripts](#convenience-scripts)
    - [Rake](#rake)
    - [Thor](#thor)
- [Elasticsearch](#elasticsearch)
- [Dev Errata](#dev-errata)
  - [What is Claude on Rails?](#what-is-claude-on-rails)
  - [How to use a new Node module or update an existing one](#how-to-use-a-new-node-module-or-update-an-existing-one)
  - [How to use a new Ruby Gem or update an existing one](#how-to-use-a-new-ruby-gem-or-update-an-existing-one)
  - [How to test nesting Quepid under a domain](#how-to-test-nesting-quepid-under-a-domain)
  - [How to run and test a local production build](#how-to-run-and-test-a-local-production-build)
  - [How to test SSL](#how-to-test-ssl)
  - [How to test OpenID Auth](#how-to-test-openid-auth)
  - [How to use the latest unreleased version via Docker](#how-to-use-the-latest-unreleased-version-via-docker)
  - [Modifying the database](#modifying-the-database)
  - [Updating RubyGems](#updating-rubygems)
  - [How does the Frontend work?](#how-does-the-frontend-work)
  - [Fonts](#fonts)
  - [How to develop Jupyterlite](#how-to-develop-jupyterlite)
  - [How do Personal Access Tokens work?](#how-do-personal-access-tokens-work)
- [Troubleshooting](#troubleshooting)
  - [Docker Issues](#docker-issues)
    - [Docker Container Won't Start](#docker-container-wont-start)
    - [Slow Docker Performance](#slow-docker-performance)
  - [Database Issues](#database-issues)
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

### Docker Based Setup

#### 1. Prerequisites

Make sure you have installed Docker.

#### 2. Setup your environment

Open up a local terminal.

Run the Bash based setup script to setup your Docker images:

```bash
bin/setup_docker
```


#### 3. Running the app

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
* Run front end unit tests: `bin/docker r rails test:frontend`
* Run back end unit tests: `bin/docker r rails test`

### Local Setup

This approach lets you run Quepid directly on your machine without Docker. It provides a more native development experience but requires setting up dependencies manually.

#### Prerequisites

1. **Ruby**: Check `.ruby-version` for the current version of Ruby.  We track the latest releases.  We recommend using a version manager like [rbenv](https://github.com/rbenv/rbenv) or [RVM](https://rvm.io/).

2. **Node.js**: Install Node.js 22.x or later.

3. **Yarn**: Install Yarn package manager.

4. **MySQL**: Install MySQL 8.0 or later.

#### Database Setup

1. Start up MySQL however you like.


#### Application Setup

1. Install Ruby dependencies:

```bash
bundle install
```

2. Set up the application:

```bash
bin/setup
```

We assume a `root` database user with the password `password`.  If your password is different you will need to edit the `.env` file created after running the setup steps.

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
bin/rails test:frontend       # Run frontend tests
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

### JS Lint

To check the JS syntax:

```bash
bin/docker r rails test:jshint
```

### Karma

Runs tests for the Angular side. There are two modes for the karma tests:

* Single run: `bin/docker r rails karma:run`
* Continuous/watched run: `bin/docker r bin/rake karma:start`

**Note:** The karma tests require the assets to be precompiled, which adds a significant amount of time to the test run.
If you are only making changes to the test/spec files, then it is recommended you run the tests in watch mode (`bin/docker r bin/rake karma:start`).
The caveat is that any time you make a change to the app files, you will have to restart the process (or use the single run mode).

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
bin/docker r rails test:frontend
```

For some reason we can't run both with one command, _though we should be able to!_.

### Performance Testing

If you want to create a LOT of queries for a user for testing, then run

```bash
bin/docker r bundle exec sample_data:large_data
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

## Convenience Scripts

This application has two ways of running scripts: `rake` & `thor`.

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
bin/docker r rails test:frontend
bin/docker r bin/rake test:jshint
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

## What is Claude on Rails?

Claude on Rails is sort of a vibe coder, sorta a dev framework for Rails available from https://github.com/obie/claude-on-rails.

We're experimenting with using it to build Quepid features! It is used during development.

To get Claude on Rails to work, you need to do development outside of Docker ;-(.

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

1. **Configure the Keycloak Identity Provider**:

   The development environment includes a Keycloak container set up in the `docker-compose.yml` file. When running the development environment with Docker, Keycloak will be available at http://localhost:9080.

   - Default admin credentials: 
     - Username: `admin`
     - Password: `password`

2. **Configure Quepid for OIDC**:

   Set the following environment variables in your `.env` file or `docker-compose.override.yml`:

   ```env
   OPENID_CONNECT_ENABLED=true
   OPENID_CONNECT_ISSUER=http://localhost:9080/realms/quepid
   OPENID_CONNECT_DISCOVERY_ENDPOINT=/.well-known/openid-configuration
   OPENID_CONNECT_CLIENT_ID=quepid
   OPENID_CONNECT_CLIENT_SECRET=your_client_secret
   ```

3. **Set up a Realm and Client in Keycloak**:

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

## Updating RubyGems

Modify the file `Gemfile` and then run:

```bash
bin/docker r bundle install
```

You will see a updated `Gemfile.lock`, go ahead and check it and `Gemfile` into Git.

## How does the Frontend work?

We use Angular 1 for the core interactive application, and as part of that we use the `angular-ui-bootstrap` package for all our UI components.
This package is tied to Bootstrap version 3.  
We import the Bootstrap 3 CSS directly via the file `bootstrap3.css`.

For the rest of Quepid, we use Bootstrap 5! That is included via the `package.json` using NPM. See `admin.js` for the line `//= require bootstrap/dist/js/bootstrap.bundle`.

We currently use Rails Sprockets to compile everything, but do have dreams of moving to Propshaft, and maybe js-bundling.

## Fonts

The *aller* font face is from FontSquirrel, and the .ttf is converted into .woff2 format.  

## How to develop Jupyterlite

Run the `./bin/setup_jupyterlite` to update the archive file `./jupyterlite/notebooks.gz`. This
also sets up the static files in the `./public/notebooks` directory. However, so that we don't check in hundreds of files,
we ignore that directory from Github. At `asset:precompile` time we unpack the `./jupyterlite/notebooks.gz` file instead.
This works on Heroku and the production Docker image.

To update the version of Jupyterlite edit `Dockerfile.dev` and `Dockerfile.prod` and update the `pip install` version.

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

### Database Connection Errors

**Symptom**: Rails can't connect to MySQL database.

**Solutions**:
1. Verify MySQL is running:
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
1. Check for JavaScript syntax errors:
   ```bash
   bin/docker r rails test:jshint
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
