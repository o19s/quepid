# Changelog

## 6.2.0 - ??

This is a major release of Quepid that finally introduces the standard _search geek_ scorers like NDCG, DCG, Average Precision, and friends by default.  We've also fixed a large number of bugs introduced by changes in browser security models and recent updates to Elasticsearch and Solr.  

Speed of development has been an issue with Quepid.  In this release we've worked on developer happiness by auditing all of the dependencies we include.  We're removed quite a few Ruby gems and NodeJS packages that weren't used, and upgraded the rest (replacing PhantomJS with Puppeteer for headless testing).  `yarn.lock` dropped from 6706 lines to 1519 and `Gemfile.lock` from 448 to 330!  This allowed us to finally move to ECMAScript 6 and to Node version 10.  Lastly we have cut the production Quepid Docker image from almost 3 GB to 2.3 GB.

### Features

* Quepid Default Scorer Admin screen is buried in UI.  Add it to the dropdown menu.  https://github.com/o19s/quepid/pull/96 by @epugh.
* Support Basic Auth in Quepid with Elasticsearch.  https://github.com/o19s/quepid/pull/114 and https://github.com/o19s/splainer-search/pull/79 by @CGamesPlay fixes https://github.com/o19s/quepid/issues/109.
* When installing Quepid, use `thor user:create` to create an administrator!  https://github.com/o19s/quepid/pull/112 by @epugh fixes https://github.com/o19s/quepid/issues/107.
* Enhanced export ratings function that follows the standard `query,docid,rating` supports full export/import lifecycle and easier integration with other tools.  https://github.com/o19s/quepid/pull/112 by @epugh fixes https://github.com/o19s/quepid/issues/128.

### Improvements

* Community member reported the default demo TMDB Elasticsearch server on port 9200 had no data.  Having seem random "drive by vandalism" of our demo Solr and ES servers that run on default ports, we want to move away. Yes, security by obscurity.  https://github.com/o19s/quepid/pull/103 by @epugh changes default used in Wizard to port 8985 and 9206.  https://github.com/o19s/quepid/pull/125 and https://github.com/o19s/quepid/issues/104 migrate existing URLs to the new ones.
* Increase Developer Happiness by speeding up the `bin/setup_docker` script by caching RubyGems.  50% speed up! https://github.com/o19s/quepid/pull/105 by @nathancday.
* Remove the concept of "communal" i.e shared with everyone scorers.  This feature has been in Quepid for years, yet even @softwaredoug didn't remember it! https://github.com/o19s/quepid/pull/99 by @epugh fixes https://github.com/o19s/quepid/issues/98.
* In the beginning of Quepid, before there was a Search Relevancy community, there was just one, slightly janky scorer, that wasn't like any of the standard search geek scorers (looking at you NDCG) that we use today.  We are building towards supporting many scorers, so it's time to remove the `DEFAULTS` definition of a scorer, and the related scope in ActiveRecord.  https://github.com/o19s/quepid/pull/97 by @epugh.
* Solr 8.2 tightened up the security profile for accessing it that we depend on via JSONP to have Quepid work.  Now the wizard provides you the command to run on your Solr if it can't connect.  https://github.com/o19s/quepid/pull/95 by @epugh fixes https://github.com/o19s/quepid/issues/92.
* Using the default `tmdb` dataset?  Demonstrate the `thumb:poster_path` feature.  https://github.com/o19s/quepid/pull/94 by @epugh fixed https://github.com/o19s/quepid/issues/72.
* Rename `user.username` in database to `user.email` since that is what we use.  Clean up API.  https://github.com/o19s/quepid/pull/113 by @epugh fixes https://github.com/o19s/quepid/issues/111.  You will need to run database migration for this release!
* Audited code base to prune dependencies and remove unused code.  https://github.com/o19s/quepid/pull/121, https://github.com/o19s/quepid/pull/119, https://github.com/o19s/quepid/pull/118, https://github.com/o19s/quepid/pull/116 all worked towards this goal.
* Turns out Quepid has a [_Curate_ interface](https://twitter.com/dep4b/status/1254885186204041217).  It isn't supported, so in the interest of reducing our codebase, removing it.  Points the way for the future however!  https://github.com/o19s/quepid/pull/123.
* Deal with sameSite cookie warnings from Firefox.  https://github.com/o19s/quepid/pull/131 by @epugh fixes https://github.com/o19s/quepid/issues/130.

### Bugs

* Wizard Autocomplete Didn't work well with Keyboard. Autocomplete suggestion had to be clicked with a Mouse.  https://github.com/o19s/quepid/pull/94 by @epugh fixes this by upgrading package.
* Multivalued and nest JSON fields didn't display well, you would get `[object Object]` instead.  Now we display arrays and Json properly.  https://github.com/o19s/quepid/pull/117 by @CGamesPlay fixes https://github.com/o19s/quepid/issues/52.
* fixed highlighting throwing an error on Solr date fields by using `hl.method=unified` in Splainer-Search v2.5.9.  https://github.com/o19s/quepid/issues/84 created by @janhoy.
* fixed fields with a `.` like `foo.bar` failing to be rendered in UI in Splainer-Search v2.5.9.  https://github.com/o19s/quepid/issues/106 created by @rjurney.


## 6.1.1 - 2020-07-03
* Community member reported race condition in standing up Rails and MySQL and issues with PhantomJS install in the developer `docker-compose.yml` and `Dockerfile.dev` setups.  https://github.com/o19s/quepid/pull/75 by @epugh fixes https://github.com/o19s/quepid/issues/76 and https://github.com/o19s/quepid/issues/73.
* Add .dockerignore file to prevent unrelated changes from breaking Docker layer cache fixes by @TheSench https://github.com/o19s/quepid/issues/80
* Fix issue where you couldn't clone a case without including the full history. https://github.com/o19s/quepid/pull/89 by @worleydl fixes https://github.com/o19s/quepid/issues/37 Thanks @janhoy for submitting this bug.
* Fixed display of notes for query disappearing after collapse and then expand of query window. https://github.com/o19s/quepid/pull/88 by @dworley fixes https://github.com/o19s/quepid/issues/87
* NDCG@10 doesn't include documents that are rated via Explain Other, it only looks at the documents returned by the search engine.  We want to be able to have NDCG look globally at all rated documents.  https://github.com/o19s/quepid/pull/90 by @nathancday and @worleydl fixes https://github.com/o19s/quepid/issues/78.  Note: We currently have the NDCG@10 scorer in app.quepid.com, however it hasn't been backported to the Docker image or the dev setup in Quepid.  See https://github.com/o19s/quepid/issues/91.

## 6.1.0 - 2020-02-01
This release changes the database schema, so you will need to run `docker-compose run --rm app bin/rake db:migrate` if you have an existing Quepid.

* Cloning cases now carries any magic variables and their values along to the new case https://github.com/o19s/quepid/pull/55 by @epugh fixes https://github.com/o19s/quepid/issues/37
* Only treat field content that begins with "http" as a link.  https://github.com/o19s/quepid/pull/35 by @pfries fixes https://github.com/o19s/quepid/issues/34
* Update Elasticsearch logo.  https://github.com/o19s/quepid/pull/38 by @moshebla
* Remove sqlite from gem, no longer used.  https://github.com/o19s/quepid/pull/41 by @epugh fixes https://github.com/o19s/quepid/issues/40
* Better look and UI experience for the dev panel.  https://github.com/o19s/quepid/pull/39 by @moshebla
* Show or don't show the T&C's link based on the Quepid configuration.  https://github.com/o19s/quepid/pull/42 by @epugh fixes https://github.com/o19s/quepid/issues/44 by @flaxsearch.
* Add Query button activates in response to query text entered.  https://github.com/o19s/quepid/pull/43 by @moshebla
* Prevent duplicate queries when using bulk query importer.   https://github.com/o19s/quepid/pull/49 by @epugh fixes https://github.com/o19s/quepid/issues/48
* Production oriented Docker Compose setup for Quepid is ready!  Install guide at https://github.com/o19s/quepid/wiki/Installation-Guide.  https://github.com/o19s/quepid/pull/36 by @epugh was based on original work in https://github.com/o19s/quepid/pull/33 by @synhershko.  Thanks!
* Update the sample TMDB dataset for Elasticsearch to support `thumb:poster_path` in the field listing.  https://github.com/o19s/quepid/issues/53 by @epugh
* Collapse query results well from bottom (in addition to the top) https://github.com/o19s/quepid/pull/28 by @epugh fixes https://github.com/o19s/quepid/issues/20 by @peterdm.  Thanks @ychaker for reviewing PR.
* Explain Other on ES 6 and 7 Broken.  https://github.com/o19s/splainer-search/pull/74 by @worleydl fixes https://github.com/o19s/quepid/issues/25.
* Support for embeds of audio/image/video via `media:`. https://github.com/o19s/quepid/pull/62 by @worleydl fixes https://github.com/o19s/quepid/issues/56 by @flaxsearch
* Autocomplete in Case Setup Wizard properly handles `media:` and `thumb:` prefixes.  Nice refactoring for more prefixes.   https://github.com/o19s/quepid/pull/46 by @moshebla with refactor by @worleydl.
* Post the onboarding wizard you would often see your queries being stalled in loading.  Only workaround was to reload the Javascript app.  https://github.com/o19s/quepid/pull/69 by @worleydl fixes https://github.com/o19s/quepid/issues/66
* app.quepid.com needs to get explicit consent from users to receive emails related to Quepid and related features.   Introducing a new `customize_quepid.rb` file in initializers to start supporting more customizations of Quepid.  https://github.com/o19s/quepid/pull/68 by @worleydl.
* Only show cookie acceptance popup if COOKIES_URL is set.  https://github.com/o19s/quepid/pull/71 by @epugh fixes https://github.com/o19s/quepid/issues/70 by @epugh.

## 6.0.2 - 2019-11-29
* Deprecate www.quepid.com/support in favor of linking to wiki.  https://github.com/o19s/quepid/pull/18 by @epugh fixes https://github.com/o19s/quepid/issues/17
* More informative error message when you delete a custom scorer and its in use.  https://github.com/o19s/quepid/pull/22 by @epugh fixes https://github.com/o19s/quepid/issues/21.

## 6.0.1 - 2019-11-05
* Update to splainer-search 2.5.0.
* Fix setting the default case for exporting when you first load Quepid.  https://github.com/o19s/quepid/pull/15 by @worleydl fixes https://github.com/o19s/quepid/issues/12
* Allow a document to be rated to have an id with a period in it like `mydoc.pdf`.  https://github.com/o19s/quepid/pull/6 by @epugh fixes https://github.com/o19s/quepid/issues/5
* Default query when setting up a new case works across Elasticsearch versions 5, 6, and 7.   https://github.com/o19s/quepid/pull/3 by epugh fixes https://github.com/o19s/quepid/issues/2
* Updates to CircleCI and update Ruby 2.5.7 by @ychaker



## 6.0.0 - 2019-07-25
* Removes everything related to payments, and makes Quepid "free"
* Adds support for using a CORS proxy for Solr instances that are not configured to allow connections from Quepid
* Replaces use of Vagrant in development in favor of Docker
* Adds support for GDPR
* Adds support for deploying Quepid on Heroku
* Upgrades Ruby version
* Upgrades Angular from 1.4.x to 1.7.x
* A bunch of bug fixes

## 5.0.2
* bugfix-888 Fixes #886: Locks version number for CSV module.

## 5.0.1
* bugfix: ES5 displaying attributes - fields are not automatically stored so `stored_fields` will not return anything, instead get the data from the `_source` field

## 5.0.0
* feature: q-score - Added graph for score history
* feature: annotations - User can now take a snapshot of the score with an annotation to describe that point in time
* bugfix-879-880-heatmap-safari Fixes heatmap in Safari

## 4.2.0
* add support for ES 5+ with `stored_fields` vs `fields`

## 4.1.1
* bugfix: Prevent re-escaping % when it's part of an escape char

## 4.1.0

* bugfix-873-change-try-name Fixes renaming try and reloading name in list
* bugfix-872-duplicate-try Fixes #872: Duplicating a try
* bugfix-852-redraw-results-with-snapshot-open Fixes updating results in open query while comparing with a snapshot
* bugfix-848-close-modal-after-deleting-try Closes modal after deleting try
* enhancement-862-document-qa-workflow Adding documentation for QA flow
* feature-863-explain-disabled-features-for-trial-user Enable popups that explain why trial user cannot perform action
* enhancement-document-magic-variables Adds documentation for Magic Variables
* bugfix-844-add-non-existing-user-to-enterprise Fixes feedback when adding non existent user to enterprise
* bugfix-857-case-insensitive-emails Fixes logging in with emails (making them case insensitive)
* bugfix-845-add-team-member Fixes feedback when adding a team member
* bugfix-843-user-autocomplete Removing entire list of users from autocomplete when adding team member
* feature-use-n-docs-in-scoring Allow users to set how many results to display by default instead of the default 10 results
* feature-company-name-in-profile Adds ability to specify company name in user profile
* feature-120-clone-case Adds ability to clone a case
* bug-796-mass-import-ratings Fixes bug in mass import of ratings
* bugfix-767-viewing-snapshots Fixes bug while views snapshots
* bugfix-big-snapshot Fixes bug while viewing large snapshots
