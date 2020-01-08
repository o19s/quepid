# Changelog

## 6.0.3 - ?
* Only treat field content that begins with "http" as a link.  https://github.com/o19s/quepid/pull/35 by @pfries fixes https://github.com/o19s/quepid/issues/34
* Update Elasticsearch logo.  https://github.com/o19s/quepid/pull/38 by @moshebla
* Remove sqlite from gem, no longer used.  https://github.com/o19s/quepid/pull/41 by @epugh fixes https://github.com/o19s/quepid/issues/40
* Better look and UI experience for the dev panel.  https://github.com/o19s/quepid/pull/39 by @moshebla
* Show or don't show the T&C's link based on the Quepid configuration.  https://github.com/o19s/quepid/pull/42 by @epugh fixes https://github.com/o19s/quepid/issues/44 by @flaxsearch.
* Add Query button activates in response to query text entered.  https://github.com/o19s/quepid/pull/43 by @moshebla
* Prevent duplicate queries when using bulk query importer.   https://github.com/o19s/quepid/pull/49 by @epugh fixes https://github.com/o19s/quepid/issues/48
* Production oriented Docker Compose setup for Quepid is ready!  Install guide at https://github.com/o19s/quepid/wiki/Installation-Guide.  https://github.com/o19s/quepid/pull/36 by @epugh was based on original work in https://github.com/o19s/quepid/pull/33 by @synhershko.  Thanks! 

## 6.0.2 - 11/26/2019
* Deprecate www.quepid.com/support in favor of linking to wiki.  https://github.com/o19s/quepid/pull/18 by @epugh fixes https://github.com/o19s/quepid/issues/17
* More informative error message when you delete a custom scorer and its in use.  https://github.com/o19s/quepid/pull/22 by @epugh fixes https://github.com/o19s/quepid/issues/21.

## 6.0.1 - 11/05/2019
* Update to splainer-search 2.5.0.
* Fix setting the default case for exporting when you first load Quepid.  https://github.com/o19s/quepid/pull/15 by @worleydl fixes https://github.com/o19s/quepid/issues/12
* Allow a document to be rated to have an id with a period in it like `mydoc.pdf`.  https://github.com/o19s/quepid/pull/6 by @epugh fixes https://github.com/o19s/quepid/issues/5
* Default query when setting up a new case works across Elasticsearch versions 5, 6, and 7.   https://github.com/o19s/quepid/pull/3 by epugh fixes https://github.com/o19s/quepid/issues/2
* Updates to CircleCI and update Ruby 2.5.7 by @ychaker



## 6.0.0
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

## 4.1.0 (7 months)

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
