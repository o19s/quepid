
# Quepid

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CircleCI](https://circleci.com/gh/o19s/quepid.svg?style=svg)](https://circleci.com/gh/o19s/quepid)
[![Docker Hub](https://img.shields.io/docker/pulls/o19s/quepid.svg)](https://hub.docker.com/r/o19s/quepid/ "Docker Pulls")
[![Rails Style Guide](https://img.shields.io/badge/code_style-rubocop-brightgreen.svg)](https://github.com/rubocop-hq/rubocop-rails)
[![Slack](https://img.shields.io/badge/slack--channel-blue?logo=slack)](https://www.opensourceconnections.com/slack)

<img src="https://quepid.com/images/logo.png" alt="Quepid logo" title="Quepid" align="right" />

**Due to DNS woes, to access Quepid use https://quepid.herokuapp.com/ till we get this fixed ;-(**

Quepid makes improving your app's search results a repeatable, reliable engineering process that the whole team can understand. It deals with three issues:

1. **Our collaboration stinks** Making holistic progress on search requires deep, cross-functional collaboration. Shooting emails or tracking search requirements in spreadsheets won't cut it.

2. ***Search testing is hard*** Search changes are cross-cutting: most changes will cause problems. Testing is difficult: you can't run hundreds of searches after every relevance change.

3. **Iterations are slow** Moving forward seems impossible. To avoid sliding backwards, progress is slow. Many simply give up on search, depriving users of the means to find critical information.


**To learn more, please check out the [Quepid website](http://www.quepid.com) and the [Quepid wiki](http://github.com/o19s/quepid/wiki).**

**If you are ready to dive right in, you can use the [Hosted Quepid](http://go.quepidapp.com) service right now or follow the [installation steps](https://github.com/o19s/quepid/wiki/Installation-Guide) to set up your own instance of Quepid.**

# Table of Contents
Below is information related to developing the Quepid open source project, primarily for people interested in extending what Quepid can do!

<!-- MarkdownTOC levels="1,2,3,4" autolink=true bracket=round -->

- [Development Setup](#development-setup)
  - [I. System Dependencies](#i-system-dependencies)
    - [Using Docker Compose](#using-docker-compose)
      - [1. Prerequisites](#1-prerequisites)
      - [2. Setup your environment](#2-setup-your-environment)
      - [3. Running the app](#3-running-the-app)
  - [II. Development Log](#ii-development-log)
  - [III. Run Tests](#iii-run-tests)
    - [BEFORE RUNNING TESTS](#before-running-tests)
    - [Minitest](#minitest)
    - [JS Lint](#js-lint)
    - [Karma](#karma)
    - [All Tests](#all-tests)
    - [Performance Testing](#performance-testing)
  - [IV. Debugging](#iv-debugging)
    - [Debugging Ruby](#debugging-ruby)
    - [Debugging JS](#debugging-js)
  - [Convenience Scripts](#convenience-scripts)
    - [Rake](#rake)
    - [Thor](#thor)
- [Elasticsearch](#elasticsearch)
- [Dev Errata](#dev-errata)
  - [I'd like to use a new Node module](#id-like-to-use-a-new-node-module)
  - [I'd like to test SSL](#id-like-to-test-ssl)
  - [I'd like to test OpenID Auth](#id-like-to-test-openid-auth)
- [QA](#qa)
  - [Seed Data](#seed-data)
- [Data Map](#data-map)
- [App Structure](#app-structure)
- [Operating Documentation](#operating-documentation)
- [Credits](#credits)

<!-- /MarkdownTOC -->

# Development Setup

## I. System Dependencies

### Using Docker Compose

Provisioning from an already built machine takes approximately 3 - 4 minutes. Provisioning from scratch takes approximately 20 minutes.

#### 1. Prerequisites

Make sure you have installed Ruby.

Make sure you have installed Docker. Go here https://www.docker.com/community-edition#/download for installation instructions. And the Docker app is launched.

To install using brew follow these steps:

```
brew cask install docker
brew cask install docker-toolbox
```

**NOTE:** you may get a warning about trusting Oracle on the first try. Open System Preferences > Security & Privacy, click the Allow Oracle button, and then try again to install docker-toolbox

#### 2. Setup your environment

Run the local Ruby based setup script to setup your Docker images:

```
bin/setup_docker
```

If you want to create some cases that have 100's and 1000's of queries, then do:

```
 bin/docker r bundle exec thor sample_data:large_data
```

This is useful for stress testing Quepid!  Especially the front end application!

Lastly, to run the Jupyter notebooks, you need to run:

```
bin/setup_jupyterlite
```


#### 3. Running the app

Now fire up Quepid locally at http://localhost:

```
bin/docker server
```

It can take up to a minute for the server to respond as it compiles all the front end assets on the first call.

We've created a helper script to run and manage the app through docker that wraps around the `docker-compose` command.  You will need Ruby installed.
You can still use `docker compose` directly, but for the basic stuff you can use the following:

* Start the app: `bin/docker server` or `bin/docker s`
* Connect to the app container with bash: `bin/docker bash` or `bin/docker ba`
* Connect to the Rails console: `bin/docker console` or `bin/docker c`
* Run any command: `bin/docker run [COMMAND]` or `bin/docker r [COMMAND]`
* Run dev mode as daemon: `bin/docker daemon` or `bin/docker q`
* Destroy the Docker env: `bin/docker destroy` or `bin/docker d`
* Run front end unit tests: `bin/docker r rails test:frontend`
* Run back end unit tests: `bin/docker r rails test`



## II. Development Log

While running the app under foreman, you'll only see a request log, for more detailed logging run the following:

```
tail -f log/development.log
```

## III. Run Tests

There are three types of tests that you can run:

### Minitest

These tests run the tests from the Rails side (mainly API controllers, and models):

```
bin/docker r rails test
```

Run a single test file via:

```
bin/docker r rails test test/models/user_test.rb
```

Or even a single test in a test file by passing in the line number!

```
bin/docker r rails test test/models/user_test.rb:33
```

If you need to reset your test database setup then run:

```
bin/docker r bin/rake db:drop RAILS_ENV=test
bin/docker r bin/rake db:create RAILS_ENV=test
```

View the logs generated during testing set `config.log_level = :debug` in `test.rb`
and then tail the log file via:

```
tail -f log/test.log
```

### JS Lint

To check the JS syntax:

```
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

```
bin/docker r bundle exec rubocop
```

Rubocop can often autocorrect many of the lint issues it runs into via `--autocorrect-all`:

```
bin/docker r bundle exec rubocop --autocorrect-all
```

If there is a new "Cop" as they call their rules that we don't like, you can add it to the `./rubocop.yml` file.

### All Tests

If you want to run all of the tests in one go (before you commit and push for example), just run these two commands:

```
bin/docker r rails test
bin/docker r rails test:frontend
```

For some reason we can't run both with one command, _though we should be able to!_.

### Performance Testing

If you want to create a LOT of queries for a user for testing, then run

```
bin/docker r bin/rake db:seed:large_cases
```

You will have two users, `quepid+100sOfQueries@o19s.com` and `quepid+1000sOfQueries@o19s.com` to test with.

### Notebook Testing

If you want to test the Jupyterlite notebooks, or work with a "real" case and book, then run

```
bin/docker r bundle exec thor sample_data:haystack_party
```

You will have lots of user data from the Haystack rating party book and case to work with.  This data is source from the public case https://go.quepidapp.com/case/6789/try/12?sort=default and https://go.quepidapp.com/books/25



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

```
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
JavaScript and CSS dependencies via the Rails Asset pipeline.   If you are debugging Bootstrap, then
you will want individual files.  So replace `//= require sprockets` with `//= require bootstrap-sprockets`.


### Debugging Splainer and other NPM packages

`docker-compose.override.yml.example` can be copied to `docker-compose.override.yml` and use it to override environment variables or work with a local copy of the splainer-search JS library during development defined in `docker-compose.yml`. Example is included. Just update the path to `splainer-search` with your local checkout!  https://docs.docker.com/compose/extends/

## Convenience Scripts

This application has two ways of running scripts: `rake` & `thor`.

Rake is great for simple tasks that depend on the application environment, and default tasks that come by default with Rails.

Whereas Thor is a more powerful tool for writing scripts that take in args much more nicely than Rake.

### Rake

To see what rake tasks are available run:

```
bin/docker r bin/rake -T
```

**Note**: the use of `bin/rake` makes sure that the version of `rake` that is running is the one locked to the app's `Gemfile.lock` (to avoid conflicts with other versions that might be installed on your system). This is equivalent of `bundle exec rake`.

Common rake tasks that you might use:

```
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

The see available tasks:

```
bin/docker r bundle exec thor list
```

Additional documentation is in [Operating Documentation](docs/operating_documentation.md#scripting-users-cases-ratings). 

# Elasticsearch

You will need to configure Elasticsearch to accept requests from the browser using [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing). To enable CORS, add the following to elasticsearch's config file. Usually, this file is located near the elasticsearch executable at `config/elasticsearch.yml`.

```yml
http.cors:
  enabled: true
  allow-origin: /https?:\/\/localhost(:[0-9]+)?/
```

See more details on the wiki at https://github.com/o19s/quepid/wiki/Troubleshooting-Elasticsearch-and-Quepid

# Dev Errata

## I'd like to use a new Node module, or update a existing one

Typically you would simply do:

```
bin/docker r yarn add foobar
```

or

```
bin/docker r yarn upgrade foobar
```

which will install/upgrade the Node module, and then save that dependency to `package.json`.

Then check in the updated `package.json` and `yarn.lock` files.

Use `bin/docker r yarn outdated` to see what packages you can update!!!!

## I'd like to use a new Ruby Gem, or update an existing one

Typically you would simply do:

```
bin/docker r bundle add foobar
```

which will install the new Gem, and then save that dependency to `Gemfile`.

You can also upgrade a gem that doesn't have a specific version in `Gemfile` via:

```
bin/docker r bundle update foobar
```

You can remove a gem via:

```
bin/docker r bundle remove foobar
```

Then check in the updated `Gemfile` and `Gemfile.lock` files.  For good measure
run the `bin/setup_docker`.

To understand if you have gems that are out of date run:

```
bin/docker r bundle outdated --groups
```

## How to test nesting Quepid under a domain.

Uncomment in `docker-compose.yml` the setting `- RAILS_RELATIVE_URL_ROOT=/quepid-app` and then open http://localhost:3000/quepid-app.

## I'd like to run and test out a local PRODUCTION build

Those steps should get you up and running locally a production build (versus the developer build)
of Quepid.

- Make the desired changes to the code
- From the root dir in the project run the following to build a new docker image:
```
docker build -t o19s/quepid -f Dockerfile.prod .
```
This could error on first run. Try again if that happens

- Tag a new version of your image.
- You can either hard code your version or use a sys var for it (like QUEPID_VERSION=10.0.0) or if you prefer use 'latest'
```
docker tag o19s/quepid o19s/quepid:$QUEPID_VERSION
```

- Bring up the mysql container
```
docker compose up -d mysql
```
- Run the initialization scripts. This can take a few seconds
```
docker compose run --rm app bin/rake db:setup
```
- Update your docker-compose.prod.yml file to use your image by updating the image version in the app ```image: o19s/quepid:10.0.0```

- Start up the app either as a Daemon (-d) or as an active container
```
docker compose up [-d]
```
- You should be able to access the app through [http://localhost](http://localhost)



## I'd like to test SSL

There's a directory `.ssl` that contains they key and cert files used for SSL. This is a self signed generated certificate for use in development ONLY!

The key/cert were generated using the following command:

```
openssl req -new -newkey rsa:2048 -sha1 -days 365 -nodes -x509 -keyout .ssl/localhost.key -out .ssl/localhost.crt
```

**PS:** It is not necessary to do that again.

The `docker-compose.yml` file contains an nginx reverse proxy that uses these certificates. You can access Quepid at https://localhost or http://localhost. (Quepid will still be available over http on port 80.)

## I'd like to test OpenID Auth

Add dev docs here!

The developer deploy of Keycloak Admin console credentials are `admin` and `password`.


## Modifying the database

Here is an example of generating a migration:

```
bin/docker r bundle exec bin/rails g migration FixCuratorVariablesTriesForeignKeyName
```

Followed by `bin/docker r bundle exec rake db:migrate`

You should also update the schema annotation data by running `bin/docker r bundle exec annotations`
when you change the schema.

## Updating RubyGems

Modify the file `Gemfile` and then run:

```
bin/docker r bundle install
```

You will see a updated `Gemfile.lock`, go ahead and check it and `Gemfile` into Git.

## How does the Frontend work?

We use Angular 1 for the core interactive application, and as part of that we use the `angular-ui-bootstrap` package for all our UI components.
This package is tied to Bootstrap version 3.  
We import the Bootstrap 3 CSS directly via the file `bootstrap3.css`.

For the rest of Quepid, we use Bootstrap 5! That is included via the `package.json` using NPM.  See `admin.js` for the line `//= require bootstrap/dist/js/bootstrap.bundle`.

We currently use Rails Sprockets to compile everything, but do have dreams of moving to Propshaft, and maybe js-bundling.

## Fonts

The *aller* font face is from FontSquirrel, and the .ttf is converted into .woff2 format.  

## I'd like to develop Jupyterlite

Run the `./bin/setup_jupyterlite` to update the archive file `./jupyterlite/notebooks.gz`.  This
also sets up the static files in the `./public/notebooks` directory.  However, so that we don't check in hundreds of files,
we ignore that directory from Github.   At `asset:precompile` time we unpack the `./jupyterlite/notebooks.gz` file instead.
This works on Heroku and the production Docker image.

To update the version of Jupyterlite edit `Dockerfile.dev` and `Dockerfile.prod` and update the `pip install` version.

Question?  Does jupyterlite work in localhost????

## How does the Personal Access Tokens work?

See this great blog post: https://keygen.sh/blog/how-to-implement-api-key-authentication-in-rails-without-devise/.

# QA

There is a code deployment pipeline to the http://quepid-staging.herokuapp.com site that
is run on successful commits to `main`.

If you have pending migrations you will need to run them via:

```
heroku run bin/rake db:migrate -a quepid-staging
heroku restart -a quepid-staging
```

## Seed Data

The following accounts are created through the `bin/setup_docker` process. They all follow the following format:

```
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

# Data Map

Check out the [Data Mapping](docs/data_mapping.md) file for more info about the data structure of the app.

Rebuild the [ERD](docs/erd.png) via `bin/docker r bundle exec rake erd:image`

# App Structure

Check out the [App Structure](docs/app_structure.md) file for more info on how Quepid is structured.

# Operating Documentation

Check out the [Operating Documentation](docs/operating_documentation.md) file for more informations how Quepid can be operated and configured for your company.

# 🙏 Thank You's

Quepid would not be possible without the contributions from many individuals and organizations.

Specifically we would like to thank Erik Bugge and the folks at Kobler for funding the Only Rated feature released in Quepid [6.4.0](https://github.com/o19s/quepid/releases/tag/v6.4.0).

Quepid wasn't always open source!  Check out the [credits](docs/credits.md) for a list of contributors to the project.

If you would like to fund development of a new feature for Quepid do [get in touch](http://www.opensourceconnections.com/contact/)!

## 🌟 Contributors

[![quepid  contributors](https://contrib.rocks/image?repo=o19s/quepid&max=2000)](https://github.com/o19s/quepid/graphs/contributors)
