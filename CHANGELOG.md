# Changelog

## 6.6.0 - ????

### Features

* OpenID Support!  Historically you had to create your own account on Quepid, but that is another barrier to entry, and something else to keep track of.  Inspired by the issue _Add OAuth Providers_ by @gregoryduckworth https://github.com/o19s/quepid/issues/188,  https://github.com/o19s/quepid/pull/280 and https://github.com/o19s/quepid/pull/389 by @epugh implements the first two providers, Google and Keycloak.

### Improvements

* Quepid is running on Rails 6!  Rails 6 was released ~26 months, and represents the future of Rails.  I'm excited that this push initiated by @DmitryKey is going to bring us some great new features like: better developer experience with Webpack for JavaScript, ActionText to handle better text formatting of notes and messages about Cases and Queries, ActionCable which will let us notify users who are rating the same case.  https://github.com/o19s/quepid/pull/381 by @DmitryKey with assist from @epugh.

* Make our ActiveRecord modeling for ownership the same.  Teams have an _owner_, Scorers have an _owner_, but Cases have a _user_.  Now we have _case.owner_ relationship.  https://github.com/o19s/quepid/pull/359 by @epugh.

### Bugs

## 6.5.5 - 2021-06-30

### Features

* You can now tag a field with `translate:`, as in `translate:content` and you will get an icon to pop the text open in a Google Translate in a new browser window.  https://github.com/o19s/quepid/pull/386 by @epugh.

### Improvements

* You can now export fields that have the formatting modifiers `thumb` and `image` using the detail format.  Also improved the handling of the General and Detail export from the Case Listing page.  https://github.com/o19s/quepid/pull/383 by @epugh fixes https://github.com/o19s/quepid/issues/382.  Thanks @DmitryKey for the improvement assist and spotting the Case Listing export issue.

* Admin user can now reset a users password with a new password.  https://github.com/o19s/quepid/pull/385 by @epugh to fix issue identified by @michaelcizmar.  Thanks Michael!

* Trying to communciate about HTTPS better when you set up a case.  https://github.com/o19s/quepid/pull/384 by @epugh inspired by https://github.com/o19s/quepid/issues/279 by @arafalov.



## 6.5.4 - 2021-06-16

### Features

* You can now Clone an existing Scorer!.  Super useful when you want to start with one of the communal scorers that only go to 10 deep, like P@10, and you want it to be P@40.  Introduced as part of https://github.com/o19s/quepid/pull/379 by @epugh.

### Improvements

* Enable TLS for Redis 6 on Sidekiq on Heroku.  https://github.com/o19s/quepid/pull/370 by @michaelcizmar fixes https://github.com/o19s/quepid/issues/271 by @michaelcizmar.  Thanks Michael for your first PR to Quepid!

* During the Case Wizard setup, allow space delimited list of fields, like `title overview` to be pasted in, just like comma delimited lists.  Thanks @peterdm for the assist on the Regex!   https://github.com/o19s/quepid/pull/378 by @epugh.

* Revamped the layout of the Scorer creation and editing screens to be visually cleaner.  Retired the old _Fibonnaci_ scale, and renamed _Default_ to _Detail_, as well as _Short_ to _Graded_ scales.  Introduced _Binary_ as a new, default scale.   @DmitryKey and @epugh paired on this during Quepid Qommunity Qoding hour, resulting in https://github.com/o19s/quepid/pull/379.

* Shrink production Docker image of Quepid from 2.19GB to 2.17GB by not installing development and test Gems.   Commit 426d2677f6c4a8380971ddc1b0faa42a53a48879 by @epugh.

### Bugs

* Preserve the chosen scorer when cloning a case, we were defaulting to the users default scorer.  https://github.com/o19s/quepid/pull/372 by @epugh fixes https://github.com/o19s/quepid/issues/273.  Thanks @binarymax and @nathancday for spotting this!

* Ensure that CSV export always has all the columns expected.   Queries that aren't fully rated and have blank values didn't put out complete set of _,_ separators.  https://github.com/o19s/quepid/pull/371 by @epugh fixes https://github.com/o19s/quepid/issues/364 by @sstults.  Spotted while working with Quaerite.

* If you don't have a Terms & Conditions url, then your users don't have an `agreed_time`, so the activity pulse chart in the admin errors out.  https://github.com/o19s/quepid/pull/373 by @epugh sorts this out.

* In the dawn of Quepid, we had `agreed_time` but not a boolean `agreed`.  A user let me know he couldn't update his email address (from an account in 2015!) because he didn't have `agreed=true` set.  https://github.com/o19s/quepid/pull/374 by @epugh cleans up some old user data.

* Fixed the labeling behavior for a Scorer.  @DmitryKey and @epugh paired on this during Quepid Qommunity Qoding hour, resulting in https://github.com/o19s/quepid/pull/379, fixing https://github.com/o19s/quepid/issues/376.


## 6.5.3 - 2021-06-01

### Bugs

* In 6.5.2 we introduced the `image:image_path` to show larger images, however there is odd wrapping if you don't have many fields listed for a doc.  https://github.com/o19s/quepid/pull/365 by @epugh fixes this.

* If you didn't have email set up, then sending invites wouldn't work.  https://github.com/o19s/quepid/pull/369 by @epugh adds better handling for when email hasn't been set up for Quepid.

## 6.5.2 - 2021-05-27

### Improvements

* We have a new Favicon, but didn't use it everywhere, so https://github.com/o19s/quepid/pull/363 by @epugh displays the new favicon everywhere.

### Features

* Rating documents where the image carries most of the information?   The existing `thumbnail:image_path` limits you to a 75 pixel wide image.  We now have `image:image_path` which displays a 200 pixel wide image.   This is an alternative to the `media:image_path` approach, as this shows up next to your fields versus inline with your fields.  https://github.com/o19s/quepid/pull/362 by @epugh fixes https://github.com/o19s/quepid/issues/360.


## 6.5.1 - 2021-05-25

### Bugs

* Now that we've had the team invitations feature out for a while, we've found places where we make assumptions that aren't correct.  This fixes the Admin panel's user page, and makes on the Teams page the messaging around pending invites.  https://github.com/o19s/quepid/pull/339 by @epugh.

* We discovered that nDCG@10 score for products with a hitCount below 10 (K) was always 0.  https://github.com/o19s/quepid/pull/336 by @rudibatt fixes this.  Thanks @rudibatt for this contribution!

* Passing in quote delimited parameters to `bin/docker r` wasn't preserving or quotes or escaping the spaces, causing the `thor user:create foo@example.com "Eric Pugh" "mysuperstrongpassword"` example to fail.  https://github.com/o19s/quepid/pull/340 by @epugh fixes https://github.com/o19s/quepid/issues/338.

* Thanks to Liz Novak at VIN for discovering that a non lowercase email address like `person@EXAMPLE.org` wouldn't be considered a valid email address, so you couldn't send a invite to join Quepid.  https://github.com/o19s/quepid/issues/342 fixed by https://github.com/o19s/quepid/pull/346 by @epugh with assist from @eribeiro.

### Improvements

* Uglifier for JavaScript appears to not work with ES6, and so using [Terser](https://github.com/ahorek/terser-ruby) instead.  https://github.com/o19s/quepid/pull/329 by @epugh fixes this.

* Add to the Team page the ability to copy the team invitation url to send via other means then Quepid's own email setup.  This is helpful if you don't have email set up, or if you want to share invites with team members via chat tools like Slack.  Also fixed the user flow of registering after someone has sent out an invite for someone.  https://github.com/o19s/quepid/pull/337 by @epugh fixes https://github.com/o19s/quepid/issues/335 and https://github.com/o19s/quepid/issues/326.

* We've added linting for our Dockerfiles via Deepsource.io.   https://github.com/o19s/quepid/pull/343 by @epugh fixes https://github.com/o19s/quepid/issues/341.

* Our Docker images are getting bloated by including log files from dev and test, leading to almost a 3 GB image.   Adding a `.dockerignore` has got us back to around 2.1 GB image.  https://github.com/o19s/quepid/pull/358 by @epugh fixes https://github.com/o19s/quepid/issues/353.

* Remove the remnants of the query test (unit test style custom scorers) and the default scorer table that are still in the source code.  https://github.com/o19s/quepid/pull/357 by @epugh fixes https://github.com/o19s/quepid/issues/349.

* Sometimes you want to create a Case even when you can't validate the connection.  Introduce a option to bypass the validation.  https://github.com/o19s/quepid/pull/356 by @epugh.

* When we export basic rating data there is an extra LF character at the end of the CSV file.   This was causing issues when importing ratings into the Quaerite project (https://github.com/tballison/quaerite/issues/14).   https://github.com/o19s/quepid/pull/355 by @epugh with assist from @sstults fixes https://github.com/o19s/quepid/issues/354 by @sstults.

* Quepid 6.5.0 started failing on Kubernetes clusters due to the need to be able to write to the filesystem.  Bootsnap dependency upgrade avoids this.  https://github.com/o19s/quepid/pull/344 by @epugh.  Thanks to @LiuCao0614 and @tonomonic for the assist on this.

* Revamp of how all the permissions for doing actions related to Teams, Scorers, and Cases to use the Permissions data we aleady have for a user.  Lots of cleanups on those functions.  Finally dealt with the left over need to have a Case per User, or the UI blew up.  Now you get a nice message, and the UI doesn't blow up.   https://github.com/o19s/quepid/pull/347 by @epugh fixes https://github.com/o19s/quepid/issues/352, https://github.com/o19s/quepid/issues/331, https://github.com/o19s/quepid/issues/278.

## 6.5.0 - 2021-04-22

![favicon](https://raw.githubusercontent.com/o19s/quepid/master/app/assets/images/favicon.ico)

I can sum up this release of Quepid as either the _Hey friend, come join me in improving search_ release or the _so much technical debt has been paid down_ release.   

For those of you upgrading your Docker based install, there are two new ENV variables you need to add to your `docker-compose.yml` file:

```
- RAILS_LOG_TO_STDOUT=true
- RAILS_SERVE_STATIC_FILES=true
```

> Hey friend, come join me in improving search

We have added features that make it easier for you to invite your colleagues to come join your team and start rating documents.  We
have reworked the initial case creation wizard to be smarter about popping up only the first time you decide to create your own case, instead of having it jump into the user flow when you join an existing team with existing cases.  This should make it easier to bring folks interested only in rating docs into Quepid.  As part of this, we've also added support for deleting individual Cases and User accounts.  So if you invite someone, and change your mind, you can clean up after yourself.

> so much technical debt has been paid down

We are finally off Rails 4.2 and are now on the latest Rails 5 release, and we have a shiny new favicon to go with it!  We've updated all of our frontend dependencies to the latest versions possible, congruent with the core app still being based on Angular1.  The lift from Rails 4 to Rails 5 was a massive effort, and a huge round of thanks goes out to everyone who reported bugs.  We've shrunk our list of dependencies by 10% over the v6.4.1 release, and 29% compared to v6.0.1 release, and we're set up now to look at new front end technologies!

We also did some housecleaning by ripping out some features that hadn't seen adoption by users, including "soft delete" of queries and the "unit test" style of custom scorers.

### Features

* Invite your friends to join your team on Quepid!  You can now send an email with an invite code to join Quepid and your specific team.   https://github.com/o19s/quepid/pull/259 by @epugh.   https://github.com/o19s/quepid/pull/305 by @epugh introduced better support for tracking of if someone had gone through the create case wizard or not, extending this feature.

* Add support for sending emails via SMTP, or use Postmark, or don't send emails.  https://github.com/o19s/quepid/pull/276 by @gabauer fixes https://github.com/o19s/quepid/issues/275.

* Let a user (or an Administrator) delete their account from Quepid, handling their cases, scorers, and team memberships.  https://github.com/o19s/quepid/pull/315 by @epugh fixes https://github.com/o19s/quepid/issues/311.

* You can now Delete a case altogether!  Historically we had an Archive function, so that you could restore an old case.  However, if you are like me, you create lots and lots of throwaway cases, so this allows you to clean up your Quepid setup.  This PR also fixed some data modeling issues, and the problem of sometimes have a Try of zero, instead of the default first try of One!   We also always include the Try number even if you have named the Try, since that is a big deal.  https://github.com/o19s/quepid/pull/288 by @epugh fixes https://github.com/o19s/quepid/issues/250.  Thanks @DmitryKey for help QA'ing this code.

### Improvements

* We now have a favicon for Quepid!  https://github.com/o19s/quepid/pull/317 by @DmitryKey.

* Upgrade to Rails 5 and Ruby 2.7.2!   We have been stuck on Rails 4.2 for years, and this unlocks a lot of new capabilities.  https://github.com/o19s/quepid/pull/256 by @epugh with inspiration from @worleydl.

* Renamed "Export Case" and "Import Ratings" to just "Export" and "Import".  https://github.com/o19s/quepid/pull/270 by @abhishekChoudhary93 fixes https://github.com/o19s/quepid/issues/195.

* Pay down some tech debt by removing our use of Coffee Script in Quepid.  https://github.com/o19s/quepid/pull/283 by @epugh.

* Build time on CircleCI dropped from ~135 seconds down to ~105 seconds by removing `sass` gem in favour of `sassc`.  https://github.com/o19s/quepid/pull/285 by @epugh.

* We have simplified our queries that involve cases and users that are part of teams by making the simplifying assumption that all owners of teams are also members, which turns out to be true in practice.   We also have audited our use of `.includes` to load child objects (avoiding the N+1 problem), and used more `.preload` to try and deal with running out of temp space in our database.   https://github.com/o19s/quepid/pull/286 by @epugh.

* Turns out we had a [ERD](docs/erd.png) diagram all along, but it was hidden.  Now you can see it on our [Data Mapping](docs/datamapping.md) page, plus we have how to recreate it documented and integrated.  https://github.com/o19s/quepid/pull/287 by @epugh.

* Remove obscure `quepidIf.js` file that doesn't seem to do anything.  https://github.com/o19s/quepid/pull/293 by @worleydl.

* The Export All Cases feature only supported the old "Detail" format, and none of the other export formats, like LTR, Basic, or RRE.  Plus the filtering options of "All, Owned, Shared" was pretty simplistic.  It wasn't being used, and it added some complexity and performance issues to List All Cases page.   So we removed it.  https://github.com/o19s/quepid/pull/295 by @epugh fixes https://github.com/o19s/quepid/issues/294.

* _Unit Test_ style custom scorers let you run a unit test that asserted specific things about specific docs at specific ranks in your search results.   This logic however was always convoluted, and only 15 people since 2019 have used it, and I suspect by accident ;-)   We want better ways of handling this type of function, so removing this to pay down some tech debt, simplify the database architecture, and open the door to new approach.  https://github.com/o19s/quepid/pull/296 by @epugh fixes https://github.com/o19s/quepid/issues/290.   https://github.com/o19s/quepid/pull/313 also dealt with this.

* We have removed the Soft Delete for Queries to simplify how Quepid works.  If you delete a query in Quepid it is now fully deleted from the database!  This is a nice bit of paying down tech debt.  Huge thanks to @DmitryKey for testing this PR.  https://github.com/o19s/quepid/pull/299 by @epugh fixes https://github.com/o19s/quepid/issues/298 by @DmitryKey.

* The `/case` url is one we frequently end up with, and it generates a 404.  Thanks @DmitryKey for suggesting we have it route to the case listing page `/cases` instead.  https://github.com/o19s/quepid/pull/304 by @epugh.

* The logic around when we popped open the "Create a Case" wizard for a brand new user was somewhat split between the backend `home_controller.rb` and the front end.   It also made anyone who was invited to a team just for rating purposes go through the Create a Case Wizard on their first login, which was awkward.   So, converted the concept of a "first_login" for the wizard to just a boolean "completed_case_wizard", and now it it checked if you have NO cases, and popped up, or if you click "Add a Case".   https://github.com/o19s/quepid/pull/305 by @epugh fixes https://github.com/o19s/quepid/issues/281.

* Upgraded to the latest version of Angular 1, 1.8.2, and many of the other front end dependencies.   https://github.com/o19s/quepid/pull/308 and https://github.com/o19s/quepid/pull/324 by @epugh and https://github.com/o19s/quepid/pull/320 by @worleydl deals with this.

* You can now override the from email address from the default `quepid@o19s.com` to your own email address.   https://github.com/o19s/quepid/pull/322 by @slawmac.  Thanks @slawmac for this improvement!

### Bugs

* You can export a rating that has no actual rating value chosen! https://github.com/o19s/quepid/pull/266 by @epugh fixes https://github.com/o19s/quepid/issues/265.

* Fixing typo in defining aria-hidden html tag.  https://github.com/o19s/quepid/pull/269 by @abhishekChoudhary93 fixes https://github.com/o19s/quepid/issues/268.

* Rails 5 Upgrade Hangover: fixed strong parameters validation issues, fixed wonky left outer joins on cases showing duplicate cases (and killed performance), eliminated the `user_case_finder.rb` class in favour of simpler scopes.  https://github.com/o19s/quepid/pull/292 by @epugh w/ assist from @worleydl.  https://github.com/o19s/quepid/pull/314 by @worleydl is related.  https://github.com/o19s/quepid/issues/321 by @janhoy fixed by https://github.com/o19s/quepid/pull/323 by @epugh.

* Thanks to @DmitryKey for spotting that we were not tracking scorers for cases (bug introduced when we added the Show Only Ratings feature).  https://github.com/o19s/quepid/pull/303 by @epugh and @worleydl fixes both https://github.com/o19s/quepid/issues/306 AND https://github.com/o19s/quepid/issues/289.  A twofer!

* Thanks to @DmitryKey for spotting that we were not properly storing the Elasticsearch choice.  https://github.com/o19s/quepid/pull/310 by @epugh fixes https://github.com/o19s/quepid/issues/309.

* There is a known issue where expanding/collapsing queries on a larger case, the UI can become completely locked in Chrome, forcing the user to close out the tab.  Thanks to some next level debugging by @LiuCao0614 we have a workaround that disables the JQuery based drag and drop sorting feature that appears to avoid this bug.   *This is not a fix!  This is a workaround!*   Set `QUERY_LIST_SORTABLE=false` in your environment to disable the sorting of queries feature.   https://github.com/o19s/quepid/issues/272 tracks this ongoing issue.

## 6.4.1 - 2021-01-14

In the 6.4.0 release, the correct splainer-search NPM package was missed in the production Docker image.

This release resolves that oversight.  Thanks @LiuCao0614 for testing the upgrade process and reporting the issue.

### Improvements

* Small housekeeping update for the hosted app version running on Heroku.  https://github.com/o19s/quepid/pull/267 by @dworley.

* Clean up last scoring run details on the Cases Listing page.  Now better iconography to call out cases that have queries that need rating.  https://github.com/o19s/quepid/pull/261 by @epugh fixes https://github.com/o19s/quepid/issues/219.

### Bugs

* Don't export ratings that don't have a rating set for RRE and Basic export formats.  https://github.com/o19s/quepid/pull/266 by @epugh fixes https://github.com/o19s/quepid/issues/265.



## 6.4.0 - 2020-12-18

*Only Rated* toggle is a powerful new feature added to Quepid, our first relevancy centric feature in a long while.

In certain relevancy cases, you may only care about the ordering of a subset of documents within the entire result set.  One particular use case may be in e-commerce where you want certain products to be boosted and others to be demoted in the ranking algorithm.  While this was doable in previous versions of Quepid, it could get difficult to manage the list of rated documents, especially if the list went many pages deep into the results.

To help solve this problem we worked with [Kobler](www.kobler.no) to introduce several new features to Quepid.  We strived to make it easier to work with your corpus of rated documents in the main case view, inside of Explain Missing Documents and within the scorers themselves.

This feature was developed by @worleydl in https://github.com/o19s/quepid/pull/229, with an initial POC by @janhoy in https://github.com/o19s/quepid/pull/220, and resolves issue https://github.com/o19s/quepid/issues/163.  Much thanks to @janhoy and the folks at [Kobler](www.kobler.no) for this feature.


### Features

 * Added "Show Only Rated" toggle to the main searchResult listing
 * Explain Missing Documents modal now defaults to showing all of your rated documents when you first open it up
 * Added eachRatedDoc function to ScorerFactory to iterate over rated documents in scoring
 * Provided refreshRatedDocs(k) in ScorerFactory for loading a custom amount of rated documents up to k

### Improvements

*  Migrated scoring to an asynchronous pipeline
* Fixed stuck "Updating queries" message when creating a new case

## 6.3.2 - 2020-12-08

### Features

* Round trip export and import LTR ranking files!  https://github.com/o19s/quepid/pull/204 by @epugh fixes https://github.com/o19s/quepid/issues/162 by @DmitryKey.

* Disable web signups by setting `SIGNUP_ENABLED=false`.  https://github.com/o19s/quepid/pull/238 by @tonomonic.

### Improvements

* Easy in-place editing of case name and the try name to encourage using those features!  [Microinteration](https://www.oreilly.com/library/view/microinteractions-full-color/9781491945957/) FTW!  https://github.com/o19s/quepid/pull/242 by @epugh.

* Demonstrate richness of queries in Quepid when you use the TMDB dataset.  https://github.com/o19s/quepid/pull/236 by @epugh fixes https://github.com/o19s/quepid/issues/224.

* Update Javascript references to `application/javascript`.  Pay down some tech debt!  https://github.com/o19s/quepid/pull/223 by @epugh

* Simplify handling doc id's that have periods or slashes in then, and avoid base64 issues by passing that in the JSON payload.  https://github.com/o19s/quepid/pull/233 by @epugh fixes https://github.com/o19s/quepid/issues/228 and https://github.com/o19s/quepid/issues/221.

* Some Solr collections need manual setup of the `wt=json` mimetype.  Add better text message for users.  https://github.com/o19s/quepid/pull/235 by @epugh fixes https://github.com/o19s/quepid/issues/178.

* The CSV export format has a CSV injection vulnerability that is now fixed.  https://github.com/o19s/quepid/pull/245 by @nicholaskwan fixes https://github.com/o19s/quepid/issues/231.

* The Javascript based scorers could be used maliciously, so we've added an environment variable COMMUNAL_SCORERS_ONLY that controls if only Admins can create communal scorers for use by users.  https://github.com/o19s/quepid/pull/246 by @jacobgraves fixes https://github.com/o19s/quepid/issues/232.

* Don't show the Sharing icon for communal scorers, since they are implicitly shared globally!  https://github.com/o19s/quepid/pull/251 by @epugh fixes https://github.com/o19s/quepid/issues/247.

* Allow the export and import cycle of ratings using both CSV and RRE formats to include queries with no rated documents. Don't create a partial rating on import where we only have a doc id but no rating.  https://github.com/o19s/quepid/pull/252 by @epugh fixes https://github.com/o19s/quepid/issues/244 by @LiuCao0614

* Make it easier for scrapers and automated test tools to log into Quepid by adding some id and class tags to the login forms.  https://github.com/o19s/quepid/pull/257 by @epugh.

### Bugs

* Discovered that the migrations from communal scorers being `@5` to `@10` didn't always run cleanly.  Commits 94dd23990422901082d79b121c1ca86a76907dc3, 8317b543530cc387d5cb89b4942acea5da57ce23, and 19b046485db530162c213a593e5b2e9df8fbbf07 to deal with this.

* Discovered that DELETE of ratings didn't work, and had to work around that.  Commit 153047cd4b75d626695f5fc38832f6202eed9007.

* Missing authorization check for Team Owner.  https://github.com/o19s/quepid/issues/230 by @jacobgraves fixes https://github.com/o19s/quepid/issues/230 by @testerTester0123456789.

* Can't rename a case on the Teams page.  https://github.com/o19s/quepid/pull/240 by @epugh fixes https://github.com/o19s/quepid/issues/213

* Fixed scoring of AP@10 and NDCG@10 when you have fewer then 10 results.  https://github.com/o19s/quepid/pull/253 by @nathancday fixes https://github.com/o19s/quepid/issues/225 by @epugh.

## 6.3.1.2 - 2020-09-16

* Silly cut'n'paste error that should have been caught with more testing before the 6.3.1.1 release, not the day after.  Fixed in commit 2e322b337cc62895847df0ed95ba6a68683dad5f by @epugh.

## 6.3.1.1 - 2020-09-15

* Default communal scorer was set to _AP@5_, however in release 6.3.1 we renamed it to _AP@10_, so doing a
quick release.  Fixed in commit 182f14d8a667759cdda559fd0ed5e063167b6914 and ad29ad199dcd25231d364e2ca95d2c09cac195ac by @epugh.
* Also found some issues with the `seeds.db` names being used.  Commit 26edccfa407119b46b6f4316f44f34d0e3e87a9f by @epugh.

## 6.3.1 - 2020-09-14

### Features


### Improvements

* When we rolled out classic graded scorers (_CG, DCT, NDCG_) we used a 5 point scale, that allows you to pick a "no choice" middle option.  However industry standard (for example RRE) is 4 point scale, so lets use 0,1,2,3 as our choices.  New Best Practices document https://github.com/o19s/quepid/wiki/Judgement-Rating-Best-Practices by @binarymax is availble to help educate you.   https://github.com/o19s/quepid/pull/206 by @epugh fixes https://github.com/o19s/quepid/issues/205.

* Closely related to the scale change, all the classic scorers used a *@5* depth of scoring, however the other industry standard in rating is to score ten deep documents, *@10*, so https://github.com/o19s/quepid/pull/209 by @epugh makes this change as well.

* Encourage use of profile pics by adding help text in Profile page that they come from Gravatar.com.  https://github.com/o19s/quepid/pull/202 by @epugh fixes https://github.com/o19s/quepid/issues/201.

* Use the same header navigation bar in both the main application and the Admin screens.  https://github.com/o19s/quepid/pull/203 by @epugh refactors this logic.

* Added `bin/docker c` option to jump into the Rails Console during development, and cleaned up the other options.  https://github.com/o19s/quepid/pull/200 by @epugh.

### Bugs

* Running `bin/setup_docker` more than once always had hiccups on dropping MySQL, and needed a `docker-compose -v`, so just make that part of the script. https://github.com/o19s/quepid/pull/208 by @epugh fixes this.

* Making HTTP links clickable wasn't working in some cases.  https://github.com/o19s/quepid/pull/211 by @e-budur fixes https://github.com/o19s/quepid/issues/183.


## 6.3.0 - 2020-09-01

### Features

* We want to export unrated query/doc pairs, which is only supported via exporting a previously created Snapshot.  Add support for exporting a Snapshot to the Basic format on the Export screen.  https://github.com/o19s/quepid/pull/191 by @epugh fixes https://github.com/o19s/quepid/issues/185.

### Improvements

* When importing queries, you can have it clear all existing queries. This feature only worked for CSV
files, not other formats like RRE.  https://github.com/o19s/quepid/pull/193 by @epugh solves this.

* You can now import queries using the *Import Ratings* screen.   Most of this was already supported, however now the modal dialog has better instructions to the user, and nicer validation of CSV formatting.  https://github.com/o19s/quepid/pull/192 by @epugh solves this.

* When sharing Cases or Scorers, the lookup for what Teams you are part of created a really large JSON response (@epugh would get back a 1.4 MB payload!).  We put this API response on a diet!  https://github.com/o19s/quepid/pull/197 by @epugh solves this.

### Bugs



## 6.2.2 - 2020-07-09

### Improvements

* When exporting for RRE, we need the ES or Solr index name.  Extract this from the url for the most recent try and save a step!  https://github.com/o19s/quepid/pull/167 by @epugh fixes https://github.com/o19s/quepid/issues/159.
* If you link to either a case that doesn't exist, or you don't have permission for, or a try that doesn't exist for a case, then provide messaging back in the UI!  Let's share some Quepid Cases!  933ed257198ebe21ff86b7e35573d3172cc2e593, 99ac27c1f8698ed726580a4c46eaf6810a4372d2, and 37b95b89fa848b0af2bae3d5a9541141e5d80d62 by @epugh to master branch fixes https://github.com/o19s/quepid/issues/158.
* `getCaseByNo` only used in tests. https://github.com/o19s/quepid/pull/173 by @epugh removes code.
* There was a partially working attempt at a result grid view instead of list view.  It wasn't rendering in the UI, and we want to have a more general solution in the future, so removing the code to simplify Quepid. https://github.com/o19s/quepid/pull/174 by @epugh fixes https://github.com/o19s/quepid/issues/171.

### Bugs

* When using the case wizard, you couldn't cut'n'paste in a long list of fields like `overview_en, overview_idioms` as they became a single tag.   https://github.com/o19s/quepid/pull/166 by @epugh fixes https://github.com/o19s/quepid/issues/165.
* A `:` in the case name was converted to a ` ` when exporting a case. https://github.com/o19s/quepid/pull/169 by @epugh fixes https://github.com/o19s/quepid/issues/168.
* The implementation of autosaving your notes per query didn't work well.  Going back to an explicit save button.  https://github.com/o19s/quepid/pull/170 by @epugh fixes https://github.com/o19s/quepid/issues/164. Thanks @DmitryKey for the issue!
* Remove warning in server log on parameters.  https://github.com/o19s/quepid/pull/182 by @epugh fixes https://github.com/o19s/quepid/issues/180.
* Community member spotted that doc id's with `blah-http-blah` triggered base64 encoding.  Simplified handling docs with an id with a `.` or `/` in them. https://github.com/o19s/quepid/pull/179 by @worleydl and @epugh fixes https://github.com/o19s/quepid/issues/175.



## 6.2.1 - 2020-06-18

Thanks to some feedback from the community, we figured out that the SQL script for
migrating data from the DefaultScorer table to the Scorers table (and being tagged
as `communal`) didn't run reliably.  We've pulled it out as `db/release_6_2_0_merge_default_scorer_into_scorer.sql` for folks to look at.

* https://github.com/o19s/quepid/issues/157 identified the issue and fixed by @worleydl.  
* Commits a1fc942d32e3d524836492f745735ce4ec4972ff and 029dd0cafe8caa492095c9483617b623a6a4e437 and 1a3c997f59b144a1cbffa59a04c67cb3e051b32d cover the migration fixes.

## 6.2.0 - 2020-06-11

This release of Quepid finally introduces the classical _search geek_ scorers like NDCG, DCG, Average Precision, and friends by default.  We've also fixed a large number of bugs introduced by changes in Firefox and Chrome browser security models that happened in the first part of 2020, as well as recent updates to Elasticsearch and Solr.

The burgeoning suite of open source tools for relevancy all require judgement lists.  We revamped Quepid to handle exporting and importing from your favorite tools like [Quaerite](https://github.com/tballison/quaerite) and [RRE](https://github.com/SeaseLtd/rated-ranking-evaluator), as well as a Learning to Rank formatted export.  You can see this in action in [Chorus](https://github.com/querqy/chorus), an ecommerce search focused stack that includes Quepid.

Ease of development has long been an issue with Quepid.  In this release we've worked on developer happiness by auditing all of the dependencies we include.  We're removed quite a few Ruby gems and Node packages that weren't used, and upgraded the rest (replacing PhantomJS with Puppeteer for headless testing).  `yarn.lock` dropped from 6706 lines to 1525 and `Gemfile.lock` from 448 to 330!  This allowed us to finally move to ECMAScript 6 and Node version 10.  Lastly we have cut the production Quepid Docker image from almost 3 GB down to 2.3 GB.

### Upgrade Notes
Follow the steps outlined at https://github.com/o19s/quepid/wiki/Installation-Guide#updating-quepid.   

You will need to run some database migrations to update the database and insert the new classical scorers (NDCG, AP, etc).

There is a sql migration script in `./db/release_6_2_0_merge_default_scorer_into_scorer.sql` that you might want to look if you have been using Quepid locally for a while.  This script is primarily meant to support updating http://app.quepid.com database for the 6.2.0 schema.

QUEPID_DEFAULT_SCORER is a new environment variable specifying the name of the default scorer
for users when they create a new case. QUEPID_DEFAULT_SCORER=AP@10 is what app.quepid.com uses.

### Features

* Quepid Default Scorer Admin screen is buried in UI.  Add it to the dropdown menu.  https://github.com/o19s/quepid/pull/96 by @epugh.
* Support Basic Auth in Quepid with Elasticsearch.  https://github.com/o19s/quepid/pull/114 and https://github.com/o19s/splainer-search/pull/79 by @CGamesPlay fixes https://github.com/o19s/quepid/issues/109.
* When installing Quepid, use `thor user:create` to create an administrator!  https://github.com/o19s/quepid/pull/112 by @epugh fixes https://github.com/o19s/quepid/issues/107.
* Enhanced export ratings function that follows the standard `query,docid,rating` supports full export/import lifecycle and easier integration with other tools.  https://github.com/o19s/quepid/pull/128 by @epugh fixes https://github.com/o19s/quepid/issues/126.
* Export ratings in RRE and LTR file formats.  Import ratings from RRE Judgement JSON file.  https://github.com/o19s/quepid/pull/137 and https://github.com/o19s/quepid/pull/139 and https://github.com/o19s/quepid/pull/152 by @epugh fixes https://github.com/o19s/quepid/issues/133
* Classical scorers like AP, DCG, and NDCG are now shipping by default.  All new users who sign up on Quepid will start with AP@5.  This effort is still in progress, for example right now the scorers are named AP@5, DCG@5, NDCG@5 because they are hard coded to only look at the first five ranks.  We also need to work on the Q Score Graph's vertical axis handling.  Huge effort in https://github.com/o19s/quepid/pull/100 by @nathancday and @epugh to get this done.  This change also removes the individual query level scorer being assignable, which was a bad idea (https://github.com/o19s/quepid/issues/132) and restores the ability to write a custom unit test for a query in Javascript (https://github.com/o19s/quepid/issues/120) which is an interesting idea!  Thanks to @janhoy for being the impetuous to get this work done!

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
* curator variables (i.e knobs and dials) that aren't used in query cause weird UI.  https://github.com/o19s/quepid/pull/135 by @epugh fixes https://github.com/o19s/quepid/issues/64.
* Saving two annotations in a row doesn't work, you need to rescore per annotation.  Fixed in https://github.com/o19s/quepid/pull/136 by @epugh.
* Users can opt out of community marketing emails.  Add a `/admin/users.csv` export to make keeping track of that easier.  Thanks @flaxsearch for the suggestion.
* Inconsistent use of X icon in modal popups is frustrating.  https://github.com/o19s/quepid/pull/148 and https://github.com/o19s/quepid/pull/149 by @worleydl fixes https://github.com/o19s/quepid/issues/146 and https://github.com/o19s/quepid/issues/145.
* Swap the sorting of tries in the history tab to the newest first, going back in time.  https://github.com/o19s/quepid/pull/151 by @epugh fixes https://github.com/o19s/quepid/issues/143 by @renekrie.
* Be clearer that MySQL is the only supported database platform.  https://github.com/o19s/quepid/pull/156 by @epugh fixes https://github.com/o19s/quepid/issues/155 by @janhoy.

### Bugs

* Wizard Autocomplete Didn't work well with Keyboard. Autocomplete suggestion had to be clicked with a Mouse.  https://github.com/o19s/quepid/pull/94 by @epugh fixes this by upgrading package.
* Multivalued and nest JSON fields didn't display well, you would get `[object Object]` instead.  Now we display arrays and Json properly.  https://github.com/o19s/quepid/pull/117 by @CGamesPlay fixes https://github.com/o19s/quepid/issues/52.
* fixed highlighting throwing an error on Solr date fields by using `hl.method=unified` in Splainer-Search v2.5.9.  https://github.com/o19s/quepid/issues/84 created by @janhoy.
* fixed fields with a `.` like `foo.bar` failing to be rendered in UI in Splainer-Search v2.5.9.  https://github.com/o19s/quepid/issues/106 created by @rjurney.
* When a try number is not specified for a case, automatically redirect to the most recent try.  https://github.com/o19s/quepid/pull/122 by @epugh fixes https://github.com/o19s/quepid/issues/110 by @binarymax.
* Case shared via Team with me has NaN for the Try.  https://github.com/o19s/quepid/pull/134 by @epugh fixes https://github.com/o19s/quepid/issues/83.
* Not able to export cases from a Team page.  Commit quepid@021bda8627463986f1ff04ffb1c290195c428c5b by @epugh fixed this.
* Race condition in laying out the main Quepid Screen and the Tune Relevance screen.  https://github.com/o19s/quepid/pull/147 by @worleydl fixes https://github.com/o19s/quepid/issues/144 by @epugh.
* Using the "peek" function to page to deeper search results would lose your `escapeQueries` choice.  https://github.com/o19s/splainer-search/pull/87 by @jorgelbg fies this.  Bump to splainer search 2.6.0 to include the fix.


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
