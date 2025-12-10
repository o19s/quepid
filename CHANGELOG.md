# Changelog

## 8.3.7 -- 2025-12-03

* Fixed issue in Bulk Judging when you paginate and you don't have enough docs left due to rating activity to get results by @epugh in https://github.com/o19s/quepid/pull/1554.  Thanks @david-fisher for finding this!
* Default to Ollama and Qwen model for local LLM as a Judge when doing development by @epugh in https://github.com/o19s/quepid/pull/1553

## 8.3.6 -- 2025-11-20

* LLMService builds the wrong URL for Google’s Gemini (OpenAI-compatible) API.  Thanks @oskrocha for reporting https://github.com/o19s/quepid/issues/1519 and @lauzel for fixing in https://github.com/o19s/quepid/pull/1521.

Sorry it took a few weeks to release Quepid with the fix!

## 8.3.5 -- 2025-10-24

There were a number of 8.3.x releases as we worked through some debugging.   8.3.5 though is the one to use!

* Query Doc Pair query_text should be case sensitive, the same way Query query_text is, but it wasn't.  So you couldn't have two queries with differing case like "Nike" and "nike" in a Book.  Thanks @david-fisher for finding https://github.com/o19s/quepid/issues/1512 and fixed in https://github.com/o19s/quepid/pull/1513.

* Query Doc Pairs for a book are synced when you run a linked Case in the background!  Previously we sent all the data in one huge JSON file that was processed immediately.  Not we submit in chunks of 100 queries, and the data is loaded in the background async to the book, smoothing the workflow.  This happens automagically for you, no need to click the "populate book" button either in the Judgements modal.  https://github.com/o19s/quepid/pull/1496 by @epugh.

* Fix bulk judgements UI under nested deployment routes.  Pin docker image to debian Bookworm for now. https://github.com/o19s/quepid/pull/1495

## 8.3.0 -- 2025-10-06

### Features

* Bulk Judging UI added for Books.  Want to quickly judge lots of documents for a set of queries in context of each other?  Bulk Judging UI is here.   You can pick a specific depth, say only results in the top 3.  Or you can search for specific query patterns.  Results are presented in random order to counteract position bias in judging.   You can also provide an explanation. https://github.com/o19s/quepid/pull/1490 by @epugh, thanks Joelle for inspiring this to finally happen. 

* Added ability to Archive a book, similar to how you can Archive a case.  This lets you hide books that you aren't currently using. https://github.com/o19s/quepid/pull/1487

* Developers using Docker no longer need Ruby to be installed locally.  Scripts have been converted to Bash.  https://github.com/o19s/quepid/pull/1479

### Improvements

* Improved syncing of Books and Cases by making it a back ground process if you have more than 50 queries.  Deals with the front end becomign sluggish and timing out when it takes a long time to sync. https://github.com/o19s/quepid/pull/1487

* Simplify book creation by defaulting to Multiple Raters choice. https://github.com/o19s/quepid/pull/1487

* All the updates across all the dependencies!  https://github.com/o19s/quepid/pull/1479

* Finally giving up on smart handling of HTTPS/HTTP protocol IN Quepid.  We tried for a long time to make Quepid aware of a search endpoints TLS setting because the browsers these days don't want you to interact across the protocols.  If Quepid was on `https` and the search endpoint was an `http` url, then we prompted to reload the browser app into the matching `http` url.  This didn't work well when Quepid is behind a proxy, as they typically take of this.  Also, we now have an actual built in capability for Quepid server to send queries to an endpoint, and it doesn't care if it's http or https.  https://github.com/o19s/quepid/pull/1427 by @epugh to remove this.  Fixes https://github.com/o19s/quepid/issues/1410 by @brucks24.

### Bugs Addressed

* Restored Annotation view in the Case screens Scores over time chart.  Fixed some visualization issues IN that chart too.  https://github.com/o19s/quepid/pull/1479


## 8.2.1 -- 2025-08-25

@david-fisher did some testing and found a couple of regressions:

* Fixed navbar drop down on Admin pages.  https://github.com/o19s/quepid/pull/1459
* Version numbers not showing up in the Dockerized version of Quepid.  https://github.com/o19s/quepid/commit/632b73cd5a5b3139be3cff070f82287bbd184adc
* Integrate into `entrypoint.sh` handling Quepid assests in a nested directory like www.mycompany.com/quepid-prod/.

@jesigger fixed the dropdowns for recent cases and books! https://github.com/o19s/quepid/pull/1415

Lastly, nicer docs on deploying Quepid locally: https://quepid-docs.dev.o19s.com/2/quepid/61/how-to-deploy-quepid-locally.

## 8.2.0 -- 2025-07-23

### What's Changed

* The biggest thing folks may notice is that we've moved from the domain name `quepid.com` to `quepidapp.com`.  This has required lots of updates in documentation, build tooling, and various links scattered around the Quepid codebase.

* Lots of refinement to the [Continuous Experimentation](https://opensourceconnections.com/blog/2023/10/18/continuous-experimentation-for-search-improvement/) support released in 8.1.0.  Quepid will run cases marked "Nightly" and store the score.  It also stores the last FIVE snapshots including document fields for additional analysis. We are limiting Snapshots to 5 to make sure we don't destroy the database ;-), and could evaluate that later.   When you load the case, we still rerun all the queries again, however there is some preliminary work about just loading the last snapshot for these nightly cases: https://github.com/o19s/quepid/pull/1323.

* Lots of improvements around the LLM-as-a-Judge.  Encrypted LLM keys in the database, nicer UI when testing out prompts, ability to evaluate images in the judging process.

* Brand new approach to documenting APIs! OpenAPI 3.1 specification compliant docs, and you can test out API calls right there in Quepid, or get the curl equivalent.  Thank you Apipie for your previous service, and I'm excited about the [OasRails](https://a-chacon.com/en/projects/oas_rails.html) project.  The lead developer, [Andrés](https://github.com/a-chacon) has been great to work with.

### Features

* Nightly Evaluation Support.  https://github.com/o19s/quepid/pull/1288 and https://github.com/o19s/quepid/pull/1289.
* You can now generate an API key for a user from the commandline: `bundle exec thor user:add_api_key EMAIL`. Thanks @frutik for the contribution in https://github.com/o19s/quepid/pull/1408

* Nightly build and push to DockerHub of Quepid image.  Thanks @frutik for https://github.com/o19s/quepid/pull/1369.

* A new Scorer!  Welcome *NDCG_CUT@10*!  NDCG is properly calculated on all the documents that have been rated for a query.  However, often we want to only look at the top 10, and cut off evaluation there, ignoring all the rest.   That is when you want *NDCG_CUT@10*.  If you had been using *NDCG@10* then you may want to swap.

* API to get the latest snapshot for a case.  Supporting a custom evaluation frontend built by @sjarmak.  Thanks @david-fisher for encouragement.  https://github.com/o19s/quepid/pull/1312 by @epugh.

### Improvements

* LLM-as-a-Judge can now look at images as part of the evaluation!  Thanks @khrabrovart for https://github.com/o19s/quepid/pull/1344 and for writing docs.  Thanks charlie@thesearchjuggler.com for making this happen.

* When testing out LLM Judge prompt display a nice spinning icon since these can be long!  https://github.com/o19s/quepid/pull/1395 by @epugh.  Did some vibe coding!

* Support Ollama based LLMs for judging.  Thanks @frutik for the initial work in https://github.com/o19s/quepid/pull/1258 that resulted in https://github.com/o19s/quepid/pull/1275.

* Nicer UI around importing books.  Let's make getting data in and out easier.  https://github.com/o19s/quepid/commit/cf0673cf4ba3f3271fcefcc91b7a6e86e5192750 and https://github.com/o19s/quepid/pull/1332 by @epugh.   Thanks @atarora for design input on this.


* Optimize the performance of editing books.  https://github.com/o19s/quepid/commit/9605a60dd28b876270cf71ac1510d2704afc64a0 by @epugh.  Thanks charlie@thesearchjuggler.com.



### Bugs Addressed

* When comparing snapshots, if you had basic auth set up then those credentials were not passed in. Thanks @kiratraynor for finding this, fixed in https://github.com/o19s/quepid/pull/1411 by @epugh.

* Judgements in a Book don't HAVE to have a user id, so fix the UI: https://github.com/o19s/quepid/commit/178594f16c1fe159f6c4789aaaab493bf9d2ee34 by @epugh.

* Fix Quepid API to support the Jupyter Inter Rater Reliablity notebook.  https://github.com/o19s/quepid/pull/1294 by @epugh.



## 8.1.0 -- 2025-02-28

We've had lots of folks trying new features of Quepid, and that has led to some nice polish.  
This is the release for people who don't want the bleeding edge version ;-).

### What's Changed

* Special characters like `$` and `@` in Basic Auth passwords are now supported.  Thanks to @atarora for opening https://github.com/o19s/quepid/issues/1245 and the debugging work from @david-fisher.  
* UX Work.  
 * We have added filtering and pagination to all of the various screens like Seach Endpoints, Communal Scorers, Users, Judgements etc.   This makes these pages load MUCH faster and you can search for the data you need.
 * Consistency across web pages.  Outside of the core AngularJS app, we had a mish mash of UI's.   Now they all have the same style header, footer, and UX treatment using card layouts.
* Fixed the nDCG calculation to look at ALL ratings, not just the top k when doing calculation.  
* Fixed a goof where the new ERR scorer wasn't added as a communal scorer for everyone.
* LLM as a Judge is better.  Cleaned up the refine UI for prompt development.
* Fix a bug where the Judge couldn't be launched from the UI.


## 8.0.1 -- 2025-02-19

Whelp, that didn't take long!  

We broke support for running Quepid on non standard ports like :3000.  https://github.com/o19s/quepid/pull/1229 by @epugh fixes this.

### What's Changed
* Bump rubocop from 1.71.2 to 1.72.2 by @dependabot in https://github.com/o19s/quepid/pull/1227
* Bump annotaterb from 4.13.0 to 4.14.0 by @dependabot in https://github.com/o19s/quepid/pull/1224
* Bump rubocop-rails from 2.29.1 to 2.30.1 by @dependabot in https://github.com/o19s/quepid/pull/1226
* Remove unused route declarations. by @epugh in https://github.com/o19s/quepid/pull/1228
* Bump activerecord-import from 2.0.0 to 2.1.0 by @dependabot in https://github.com/o19s/quepid/pull/1207
* Fix prefer ssl logic to not blindly force port 80 by @epugh in https://github.com/o19s/quepid/pull/1229


**Full Changelog**: https://github.com/o19s/quepid/compare/v8.0.0...v8.0.1

## 8.0.0 -- 2025-02-14

It's Valentine's Day 💘, so it seems appropriate to release the next major version of Quepid, the tool to give your queries some ❤️.

### Exciting News

**Judge Judy is now appearing on the Quepid channel**.  It is now possible to create one or more LLM-based AI judges in Quepid! Set your OpenAI key, add your examples or customizations to the judgement prompt, push the big button, and let the magic box do the rest.

**[Continuous Experimentation](https://opensourceconnections.com/blog/2023/10/18/continuous-experimentation-for-search-improvement/)** is now a reality in Quepid. You can now schedule automatic evaluation runs on a case on a daily basis. It is now possible to see the most up to date performance results, and track changes over time without loading up Quepid!  You can even configure alerts to be emailed to you if your Case score drops!

**Scaling Up**. Quepid now supports many thousands of Queries in a single Case! Our target is 5000 queries in a single Case, and by adopting background processing and async feedback in the user interface, we can now scale up to handle this.  Oh, and query performance has been drastically improved.  One long time user with 1000 queries reports that loading the case has dropped from 20 minutes to three minutes ;-).  Cases with a large number of queries can have problems completing, due to timeouts or 429 (too busy, try again) errors. Thanks to @mkr the concurrency control for handling query execution has been updated to prevent Quepid hanging up forever waiting for a query to complete.

**[Expected Reciprocal Rank](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=7e3cf6492128f915112ca01dcb77c766129e65cb) (ERR)** is now available as a community scorer. This scorer is appropriate for multi-valued judgment ranges when evaluating search journeys like known item search.

**New [User Manual](https://quepid-docs.dev.o19s.com/2/quepid)**.  We've embraced the [Diátaxis](https://diataxis.fr/) framework for writing documentation, and consolidated into a single platform the mix of documentation that has been published in various locations.  

### Bugs Addressed
If you don't have P@10 defined, the migrations blow up. Thanks @frutik for finding the bug. https://github.com/o19s/quepid/pull/1093

Basic auth that includes '%' in username or password breaks reloading from http to https. Thanks @brucks24 for  https://github.com/o19s/quepid/issues/1139

Emoji filled queries like `kfc 🍟➕🍔➕🍗` now can be stored in Quepid!  Thanks @shuttie for reporting this bug.  https://github.com/o19s/quepid/issues/1046

### Other Changes

* Simpler Deployment. We've updated to Rails 8, and no longer need Redis.  We're back to just a server and a MySQL Database ;-).  
* Nicer import book page. Gave it some UX love. Kudos to @wrigleyDan 
* We use the built into Rails health check end point at /healthcheck. Please check your setup.
* Change tracking of scores to record which scorer produced the score. This is a **breaking change**, as previous versions don't know what scorer generated a score. For historical scores, the current case scorer is assumed to be the only scorer used on that case.  Soon you will be able to run multiple scores and pick one as your "North Star" metric.
* We thought having really fine grained permissions would be important to Quepid, but what we've seen is that it doesn't matter. Indeed, if anything, the permissions structure is confusing to users. Additionally, we've mostly cared "are you an Admin?" to decide if certain things can be done or not. So it's gone.
* We care about privacy.  We've dropped Google Analytics in favour of our own first party analytics.   We've also dropped the Intercom integration.

### What's Changed
* undo the "fit" that made us only run a single test by @epugh in https://github.com/o19s/quepid/pull/1076
* Updates oct 2024 by @epugh in https://github.com/o19s/quepid/pull/1071
* Add check for the existence of scorer before updating. by @epugh in https://github.com/o19s/quepid/pull/1093
* Migration to Rails 8 by @epugh in https://github.com/o19s/quepid/pull/1084
* Rails 8 is out, and we drag along a swap from annotate to annotaterb by @epugh in https://github.com/o19s/quepid/pull/1098
* Strip out SASS by @epugh in https://github.com/o19s/quepid/pull/1113
* swap to released version of Bullet by @epugh in https://github.com/o19s/quepid/pull/1102
* Tweaks to text. by @epugh in https://github.com/o19s/quepid/pull/1119
* Hard-limit search concurrency to 10 by @mkr in https://github.com/o19s/quepid/pull/1103
* Restore proper support for notifying users about Cookies being required policy by @epugh in https://github.com/o19s/quepid/pull/1127
* Update jshint structure  by @epugh in https://github.com/o19s/quepid/pull/1135
* Be smart about if we have no score yet, and share that info. by @epugh in https://github.com/o19s/quepid/pull/1132
* ship a first cut of being smarter by @epugh in https://github.com/o19s/quepid/pull/1133
* Frogs forever by @epugh in https://github.com/o19s/quepid/pull/1136
* Change the close icon to something that renders larger and more visible by @epugh in https://github.com/o19s/quepid/pull/1140
* Warn on incompatible characters in basicauth password by @epugh in https://github.com/o19s/quepid/pull/1143
* Wire in deleting the case when you abandon it.   by @epugh in https://github.com/o19s/quepid/pull/1144
* First party analytics by @epugh in https://github.com/o19s/quepid/pull/1100
* Fix up the routing logic to keep you in the rating experience. by @epugh in https://github.com/o19s/quepid/pull/1145
* Perf optimizations. (again!) by @epugh in https://github.com/o19s/quepid/pull/1148
* On to 3.3.6 of Ruby by @epugh in https://github.com/o19s/quepid/pull/1157
* Add err scorer by @david-fisher in https://github.com/o19s/quepid/pull/1162
* Backout counter_cache by @epugh in https://github.com/o19s/quepid/pull/1165
* Review database structures by @epugh in https://github.com/o19s/quepid/pull/1167
* Improve links/buttons when creating a Book by @wrigleyDan in https://github.com/o19s/quepid/pull/1175
* Meet Judge Judy, she is your AI powered SME by @epugh in https://github.com/o19s/quepid/pull/985
* Missing indexes on Search Endpoints by @epugh in https://github.com/o19s/quepid/pull/1173
* Spike 5000 queries round deux by @epugh in https://github.com/o19s/quepid/pull/1039
* Remove permissions architecture in favour of roles by @epugh in https://github.com/o19s/quepid/pull/1185
* Restore the proper encoding, lost somewhere by @epugh in https://github.com/o19s/quepid/pull/1188
* Look at database consistency issues by @epugh in https://github.com/o19s/quepid/pull/1189
* Testing the flow of everything.... by @epugh in https://github.com/o19s/quepid/pull/1192
* fix RRE export format by @epugh in https://github.com/o19s/quepid/pull/929
* Properly nest returning judgements for a book under the book route by @epugh in https://github.com/o19s/quepid/pull/1187
* OpenAPI query limits being hit  by @epugh in https://github.com/o19s/quepid/pull/1194
* Can we use Blazer to monitor users? by @epugh in https://github.com/o19s/quepid/pull/1205
* FInally remove intercom by @epugh in https://github.com/o19s/quepid/pull/1206
* Validate search endpoints by @epugh in https://github.com/o19s/quepid/pull/1209
* Simplify book ux by @epugh in https://github.com/o19s/quepid/pull/1200
* Need to track which scorer provided the score! by @epugh in https://github.com/o19s/quepid/pull/1210
* Manage all Case scores, and let you delete the werid scores. by @epugh in https://github.com/o19s/quepid/pull/1213
* Fancier handling of scores and ratings and judgements and fix search endpionts and all the other things that make it hard for @david-fisher to write changelog notes. by @epugh in https://github.com/o19s/quepid/pull/1215
* nicer filtering makes loading books faster... by @epugh in https://github.com/o19s/quepid/pull/1216
* Document why updating a rating doesn't update the specifics in a query_doc_pair by @epugh in https://github.com/o19s/quepid/pull/1219
* Remove owner concept by @wrigleyDan in https://github.com/o19s/quepid/pull/1181
* Strip out remaining references to team ownership. by @epugh in https://github.com/o19s/quepid/pull/1221
* Testing of Quepid8 Functions by @epugh in https://github.com/o19s/quepid/pull/1222
* Revamp Query.query_text to handle emoji better by @epugh in https://github.com/o19s/quepid/pull/1223

**Full Changelog**: https://github.com/o19s/quepid/compare/v7.18.0...v8.0.0

## 7.18.1 - 2024-12-06

We've been hard at work on Quepid8, however we have two items that demand a point release:

* Bug fix when looking up potential Querqy rule use and we hadn't finished running the query.  https://github.com/o19s/quepid/commit/cb9e3f4b4fce07c0acfc5301d7c00fcc7b7c8d23 by @epugh.

* Prevent run away querying!  A user of Quepid has a proxy between Quepid and the search engine, and we were overloading it.  https://github.com/o19s/quepid/commit/7cb1f55b7e2cf1f08c06f4d38a0ac3eb679450b4 by @mkr!

## 7.18.0 - 2024-10-04

Wow!  It's been three months since the last release of Quepid, so it's about time.   
This release brings Quepid up to Rails 7.2 standard, which gets us ready for some of the interesting things in Rails 8, specifically simplifying what you need to run Quepid.  
There is a good path to removing the dependency on Redis, and maybe even MySQL for small setups!

### Improvements

* Shrink the Quepid Docker image by 1 GB.  This was accomplished by the migration to Rails 7.2 for Quepid in https://github.com/o19s/quepid/pull/1058, fixing https://github.com/o19s/quepid/issues/1004 by @epugh.

* Expanded Quepid's API for working with Search Endpoints.  Thanks @clintbxtreme for opening https://github.com/o19s/quepid/issues/1056, and this was fixed in https://github.com/o19s/quepid/pull/1057 by @epugh.

* Using SMUI and want to see if your rule was triggered?  Now you can, we have a Querqy icon!  Previously you would have to dig into the query parsing explanation to know.  https://github.com/o19s/quepid/issues/1050 by @clamar-VM was fixed by https://github.com/o19s/quepid/pull/1053 by @epugh.

### Bugs

* When rating images that have a prefix defined, the prefix was being lost.  Thanks @clamar-VM for finding this, fixed in @https://github.com/o19s/quepid/pull/1054 by @epugh.

* We got too strict with our cookies, and Quepid quit working with Keycloak.  Thanks @drieschel for https://github.com/o19s/quepid/pull/1049.

## 7.17.1 - 2024-06-26

### Improvements

* Proxied connections can now handle non ASCII characters like `café`.  https://github.com/o19s/quepid/pull/1043 by @epugh.  Thanks @miguelmesas for opening up the ticket that tipped me off to this.

* `p@10` scorer now is smarter to handle non binary judgements.  https://github.com/o19s/quepid/pull/991 by @david-fisher.  Sorry this took so long to get merged!

* RAG style queries are MUCH longer.  @miguelmesas opened up which is fixed by https://github.com/o19s/quepid/pull/1042 and https://github.com/o19s/quepid/pull/1037 by @epugh.

* Improve the bulk query API to support 1000's of queries.  https://github.com/o19s/quepid/pull/1037 by @epugh.

* Small tweaks to the layout of the Search Endpoints to move the Destroy action away from the edit action.  Thanks @okkeklein for reporting https://github.com/o19s/quepid/issues/900. 

### Bugs

* Resetting skipped and can't judge query/doc pairs is fixed.  Thanks @pfries for opening https://github.com/o19s/quepid/issues/1040.   Quite a few other Turbo Drive related navigation issues fixed.

## 7.17.0 - 2024-06-14

This is a big one!   We have broken the tyranny of the web request/response lifecycle by embracing some powerful Rails technologies:
  
 * ActionCable: We now support two way communication from the backend server to your front end browser via Web Sockets.  This lets us notify not just the person who starts a long running process of updates, but also any OTHER user who is interested in a specific topic.   For example, if someone uploads a Book with many thousands of judgements, then everyone who is part of that team can see the progress for them selves.   
 
 * ActiveJob: This let's us run background jobs.  Historically we only used it for tracking of events (like you visited a Case), however now we are using it for processing large data sets in the background.  
 
 * ActiveStorage: We need to better handle LARGE datasets in Quepid.  ActiveStorage lets us build massive export files and store them in the database as a binary until you decide to download the data.  Likewise, importing large data files that take time to process is now supported by being able to store them in Quepid.

 * Hotwire: HTML over the Wire lets us render HTML on the backend using our familiar Rails MVC, but magically stream the updates to the front end.  This lets us add interactivity without requiring us to build out a Single Page Javascript application.  
 
 These changes are going to enable a future for Quepid that let's it scale up signficantly and be a richer environment for measuring relevance and working with search!
 
 Okay, now on to our more detailed list of changes:
 
### Features

* You can now run your Query Evaluations OUTSIDE of Quepid, and store the scores INSIDE Quepid.  This gives you a place to share this information with folks in your team.   See the example Python scripting here: https://github.com/o19s/quepid/tree/main/docs/examples/external_eval.  We also enhanced the API documentation.  https://github.com/o19s/quepid/pull/1034 by @epugh.

* HTML Over the Wire!  Now we only load HTML that has changed, which improves page percieved performance.   Added new export and import of Books as background jobs with notifications to users over Web Sockets.  You then can download the resulting file without waiting for the data processing.  Loading aspects of the home page asyncrhonsly so the page loads super fast, and then content renders in as available. https://github.com/o19s/quepid/pull/992 by @epugh.

### Improvements

* Update to Rails 7.1 standards.   https://github.com/o19s/quepid/pull/1033 by @epugh.

* Nicer Admin Homepage visual layout.  https://github.com/o19s/quepid/pull/1031 by @epugh.

* Revamped performance of the Home page to not recalculate the case summaries if you've already cached them in the browser.  Much faster page!  https://github.com/o19s/quepid/pull/1022 and https://github.com/o19s/quepid/pull/1029 by @epugh.

* New Case Wizard is smarter about existing Search Endpoints pane.  https://github.com/o19s/quepid/pull/1012 by @epugh.

* Lots of updates to all the dependencies!

### Bugs

* Swapping between HTTP and HTTPS end points would cause issues with your Search Endpoint configuration.  https://github.com/o19s/quepid/pull/1035 by @epugh fixes https://github.com/o19s/quepid/issues/1005.

* We state that judging a query doc pair only requires three jdugements, but didn't actually make that work.  https://github.com/o19s/quepid/pull/1032 by @epugh and @wrigleyDan fixes https://github.com/o19s/quepid/issues/1019 by @wrigleyDan.

* Fixed utf encoding in mysql for query_doc_pairs.  https://github.com/o19s/quepid/pull/1017 by @epugh fixes https://github.com/o19s/quepid/issues/1013 by @wrigleyDan.

* Pass basic auth credentials through when you view a specific document or use Quepid as a proxy to your search engine.  https://github.com/o19s/quepid/pull/1015 by @epugh fixes https://github.com/o19s/quepid/issues/1014 by @david-fisher.

## 7.16.1 - 2024-04-09

### Bugs

* You can delete a user who has existing judgements, and then that messes up the main Books page because their judgements hang around.  Now you are warned about this, and you can choose to make their judgements anonymous.  (or just Lock their user account).  https://github.com/o19s/quepid/pull/999 by @epugh.

## 7.16.0 - 2024-03-28

### Features

* Now have a dropdown for Books similar to Cases that leverages our existing tracking of what books you have viewed.  https://github.com/o19s/quepid/pull/986 by @epugh.

* We now run scorers over queries that have no ratings and queries that are ZSR.  This lets us have smarter logic about how you want to score those situations.  https://github.com/o19s/quepid/pull/993 by @epugh.

### Improvements

* One less query to determine what a user has access to via being an owner or a member of a team while ensuring no duplicate cases/books show up.  https://github.com/o19s/quepid/pull/982 by @epugh with input from @reid-rigo. 

* Remove extranous faraday logs when running tests.  https://github.com/o19s/quepid/pull/983 by @epugh with input form @reid-rigo fixes https://github.com/o19s/quepid/issues/964.

* Nicer onboarding using TMDB dataset for Algolia users.  https://github.com/o19s/quepid/pull/987 by @chuckmeyer.

### Bugs

* Book Importing was broken. Plus now we have nicer formatted error message when you validate a book to import.  https://github.com/o19s/quepid/pull/989 by @epugh.



## 7.15.1 - 2024-03-13

### Bugs

* Looking up Cases for a user is returning duplicates due to missing "distinct" keyword on SQL Query.  https://github.com/o19s/quepid/pull/980 by @epugh.

* The "bundle exec thor case:create" is NOW updated to handle SearchEndpoints.  https://github.com/o19s/quepid/pull/981 by @epugh.


## 7.15.0 - 2024-03-11

### Features

* Now track an _Explanation_ for a judgement.  If a human clicks "I can't rate this" then they are prompted for an optional explanation why.  In the near future, LLM powered judgements will communicate a explanation as well!  https://github.com/o19s/quepid/pull/978 by @epugh.

* Algolia integration!  We have a wonderful contribution from @sumitsarkar that adds Algolia as one of the supported Search engines.  https://github.com/o19s/quepid/pull/933 by @sumitsarker.

### Improvements

* Move to using Thor (an existing CLI tool) for loading all our sample data files, and less custom Rake code.  https://github.com/o19s/quepid/pull/966 by @epugh.

* Better UX when working with custom search API's and the mapper code.  https://github.com/o19s/quepid/pull/965 and https://github.com/o19s/quepid/pull/963 by @epugh, fixing https://github.com/o19s/quepid/issues/959, https://github.com/o19s/quepid/issues/960, https://github.com/o19s/quepid/issues/961 by @wrigleyDan and https://github.com/o19s/quepid/issues/950 by @ErikHatcher. 

* Proxied Search API requests should follow Redirects.  https://github.com/o19s/quepid/pull/962 by @epugh fixes https://github.com/o19s/quepid/issues/958 by @wrigleyDan.

* Improved performance of checking case access permissions.  https://github.com/o19s/quepid/pull/955 by @reid-rigo.  Thanks Reid!

* Updated the Jaccard, RBO, and Judge comparison notebooks that ship with Quepid. Introduced more robust testing for them. https://github.com/o19s/quepid/pull/956 by @epugh.

* Improve the Books API.  https://github.com/o19s/quepid/pull/951 by @epugh.

* Snapshots used to have "Best Snapshot" option, but it hasn't worked in years, so stripped it out.  https://github.com/o19s/quepid/pull/948 by @epugh.


### Bugs

* Scoring logic was all somewhat broken.  Add a query, it doesn't rescore.  Delete a query, it doesn't rescore. Have a ZSR query, it impacts scoring in a "wonky" way.  Then, when you introduce snapshot comparisons, it all gets weirder.  We've gone through at a pretty line by line debugger level and fixed the various interaction bugs.  https://github.com/o19s/quepid/pull/975 by @epugh.

* Only ship Web Open Font fonts, which simplifies our CSS and set up and eliminates a warning in Firefox console.  #techdebt.  https://github.com/o19s/quepid/pull/974 by @epugh.

* Fixed some bit rot in handling of Tries in the web UI, and do some polish of UX.  https://github.com/o19s/quepid/pull/967 by @epugh.

* Check length of query_text. https://github.com/o19s/quepid/pull/952 by @epugh and @mkr.

* No email provider?  No problem!  Fixed issue with inviting folks and no email provider setup. https://github.com/o19s/quepid/pull/949 by @epugh.

## 7.14.0 - 2024-02-06

### Features

* SCALING SCALING SCALING.   Now possible, though painful still, to run 5000 queries by moving lots of activities to background processing.   Thanks to my colleagues on the Cville Slack communities #ruby channel for lots of advice and help.  https://github.com/o19s/quepid/pull/916 by @epugh.

* Quepid truncates the document fields in the core display, either via using highlighting to pluck out a section, or just snippeting to 200 characters.  However some days you just want to see the entire field!  Now you can control this in your field specifciation by prepending the field name with `unabridged:` tag.   https://github.com/o19s/quepid/pull/946 by @epugh.  

* Need to communicate with your users about a new Scorer or upcoming downtime?  You can now post Annoucements to your users.  https://github.com/o19s/quepid/pull/911 by @mkr and https://github.com/o19s/quepid/pull/941 by @epugh fixes https://github.com/o19s/quepid/issues/848 for @flaxsearch.

### Improvements

* Snapshots require you to be able to "lookup" the document by id from the search engine.  However some search engines like Vectara and the Search API don't support this.  Reworked how snapshots work to require you to save the document fields at snapshot creation time in order to power the snapshot comparison UI.  This may end up being spread to other search engines as well.  https://github.com/o19s/quepid/pull/945 and https://github.com/o19s/quepid/pull/931 by @epugh.

* The logs in Quepid are being overwhelmed by the size of the documents.  https://github.com/o19s/quepid/pull/942 by @reid-rigo cleans this up.  Thank you Reid!

* Stripped out Threshold based alerting on queries, the community never used them.  https://github.com/o19s/quepid/pull/927 by @epugh.

* Now tracking when a Book was viewed by a user, which powers the dashboard.  https://github.com/o19s/quepid/pull/925 by @epugh.

* Removed the `QUEPID_PROPHET_ANALYTICS` environment variable, as Prophet was never a performance issue.  https://github.com/o19s/quepid/pull/924 by @epugh.

* Dropped old database columns in the `tries` table that had moved to `search_endpoints` table.  https://github.com/o19s/quepid/pull/930 by @epugh.


### Bugs

* Restore the thor commands for creating an admin user.  https://github.com/o19s/quepid/pull/922 by @epugh fixes https://github.com/o19s/quepid/issues/888 by @vincetrumental.

* Bug fix for static search endpoint when Quepid is running in a nested host context.  https://github.com/o19s/quepid/pull/917 by @epugh.

* We were not export notes and options for a query.  https://github.com/o19s/quepid/pull/926 by @epugh fixes https://github.com/o19s/quepid/issues/923 by @peterdm.

Plus we updated to the latest of Ruby and Ruby gems, Mysql, various NPM packages.



## 7.13.0 - 2024-01-03

Just in time for the New Year!

A number of changes all wrapped up in one large PR https://github.com/o19s/quepid/pull/906 by @epugh.  This one is for you @david-fisher ;-).

*  Now when you judge a query doc pair for a Judgement Book we update in the background any associated Cases that have that query.  This eliminates the need to manually refresh the ratings for a Case from the Judgement Book!  Thanks @david-fisher for the suggestion in https://github.com/o19s/quepid/issues/829.

* Provide an option to allow queries that exist on a Book to be created in the Case if they are missing.   The default behavior is to NOT create queries in a Case from the Book.  Thanks to @jvia for this suggestion.  https://github.com/o19s/quepid/issues/871.

* Band-aid the awkwardness that Cases have Queries/Ratings while Books have QueryDocPairs + Judgements, and that there are attributes on a Query like `information need`, `notes`, or `options` that don't exist on a QueryDocPair.   So now we preserve them, which facilitates round tripping better.   Upload a Book?  Upload a Case?  It doesn't matter ;-)  Long term we need to merge these two data structures...   

* When Books were first added to Quepid, they didn't follow the same permissions/sharing structure that Scores and Cases did.  Now you can share a Book with multiple Teams!  Fixes https://github.com/o19s/quepid/issues/907

* And as an aside, anyone can edit a custom scorer, not just the Owner of it.  https://github.com/o19s/quepid/issues/762 suggested by @david-fisher.


## 7.12.3 - 2023-12-05

* Restore `thor` based scripts by letting you run `docker compose run app bundle exec thor list` to see all the thor scripts available for interacting with Quepid.  https://github.com/o19s/quepid/pull/904 by @epugh, reported by @vincetrumental in https://github.com/o19s/quepid/issues/888.

* Bump splainer-search to 2.30.7 to pass through basic auth properties to Solr.

## 7.12.2 - 2023-12-01

We discovered that your custom headers can be very long!  Thanks @tiagoshin for the patch to extend the length of custom headers in the database.  https://github.com/o19s/quepid/pull/903 by @tiagoshin.

## 7.12.1 - 2023-12-01

7.12.0 introduced a change in splainer-search that breaks `searchapi` :-(.

* Rollback splainer changes, but also some polish on the UX for going from the Case judgement screen to the Share with a Team.   Also make parsing the csv file for the `static` api more robust.  https://github.com/o19s/quepid/pull/894

## 7.12.0 - 2023-11-30

A flurry of changes based on feedback from the community.  This is basically a "improve" Quepid release.

### Features

* Now show the last run on using friendly times, like "one hour ago".  https://github.com/o19s/quepid/pull/892 by @epugh.

### Improvements

* Restored in the homepage and the case listing the "last run on" and "last run by" information.  Adding this had been causing performance issues, but hoping we worked this out. https://github.com/o19s/quepid/pull/891 by @epugh.

* Some general fixes to handling static defined search case and search endpoints.  https://github.com/o19s/quepid/pull/886 by @epugh.

* Also, the usual upgrades to Rails, Node etc.  We are now on Rails 7.1.3, though we still need to update some configuration settings from Rails 7.0 to 7.1.

### Bugs

* Respect the proxy setting for a search end point in doing a snapshot compare lookup, and in linking to individual docs.  https://github.com/o19s/quepid/pull/893 by @epugh.  Thanks @david-fisher for finding this.

* We now support custom headers for search apis.  Thanks @dacox for the fix in https://github.com/o19s/splainer-search/pull/138.  

* Made more robust the adding of queries for a static CSV case.  https://github.com/o19s/quepid/pull/889 by @epugh.  Thanks to @tiagoshin for identifying the issue.


## 7.11.0 - 2023-11-19

### Features

Want to have custom filters or other variables per query?  You can now access a per query `#$qOption##` hash of JSON data in your query template.  For example, if you are accessing a RAG endpoint, and you are passing in a query and need some query specific document ids, you can now do that!

https://github.com/o19s/quepid/pull/883 and https://github.com/o19s/quepid/pull/885 by @epugh.   Big thanks to @mkr for his work on splainer-search upgrades to support this, and @atarora for masterminding the use of the `qOption` in queries.

### Improvements

* More robust handling of the Static File end point, and better handling of proxied queries that don't return json.  https://github.com/o19s/quepid/pull/886 by @epugh.

* On to Rails 7.1.2!  https://github.com/o19s/quepid/pull/837 by @epugh.

## 7.10.0 - 2023-11-03

Big feature!  Or should I say big refactoring?   Meet your new friend "The Search Endpoint".  You can now configure a connection to a search engine, maybe one of the classic ones like Solr, OpenSearch, or Elasticsearch, or some new ones like "Static CSV File" or even a "Custom Search API".  Once that is configured, then you can reuse that connection over and over.  Even better, you can share it with your friends in your Team, similar to how you share Cases and Scorers.

You can say good by to search urls like "http://internal-ecs-m-loadb-1jj589wq3y25-167256740489.us-east-1.elb.amazonaws.com/" and welcome to "Stage Search" ;-).  If you change where "Stage Search" is pointing, update it one place and it is used by all the Cases (and Tries) that used it.

### Features

* Search Endpoints refactoring in https://github.com/o19s/quepid/pull/788, https://github.com/o19s/quepid/pull/850 and https://github.com/o19s/quepid/pull/852 by @epugh.

* Documenting our APIs is started!  Thanks to @jvia, we have some basic docs on the Cases api.  https://github.com/o19s/quepid/pull/824, https://github.com/o19s/quepid/pull/838 by @jvia and https://github.com/o19s/quepid/pull/808 by @epugh.

### Improvements

* On to Node 20!  https://github.com/o19s/quepid/pull/837 by @epugh.


## 7.9.2 - 2023-09-20

You can now export and import Case's and Book's cleanly from one Quepid to another Quepid, with proper error handling.  You can also use this to export a Case or Book, make a bunch of changes externally using other tools, and then bring it back in.

Get a dump file named `case_25.json` via:

```
python case_export.py --case_id=25 --root_url=https://go.quepidapp.com --access_token=YOUR_ACCESS_TOKEN
```

And bring it back in via:

```
python case_import.py --case_file=case_25.json --root_url=http://localhost:3000 --access_token=YOUR_ACCESS_TOKEN
```

More docs and some sample scripts coming soon.

https://github.com/o19s/quepid/pull/834 by @epugh.

## 7.9.0 - 2023-09-12

* In running the Case --> Book --> Case lifecycle, we found that the automatic creation of Judgements for a Book from Ratings for a Case was creating extra averaged ratings when a Case supports multiple raters.  (it's fine if there is only one rater).   This was messing up the scores.  https://github.com/o19s/quepid/pull/827 by @epugh fixes this by making it an Advanced option, and introducing a Edit Book option to delete judgements by specific judge.  Thanks @david-fisher for figuring this out.

* [Vectara](https://www.vectara.com/), a vector search engine is now accesible from Quepid!  This is the first non Lucene keyword search engine to be surfaced in Quepid and we're learning a lot.  There are some limitations, like you don't get the Explain for the query, and we are focused on surfacing what Vectara calls "Documents" versus "Responses" in the Quepid UI.  https://github.com/o19s/quepid/pull/826 by @mkr.  Also https://github.com/o19s/splainer-search/pull/128 by @mkr.

## 7.8.0 - 2023-09-08

* Need to copy the query from the Cases screen?  Yes, there is now a little Copy to Clipboard icon.  https://github.com/o19s/quepid/pull/823 by @epugh fixes implements https://github.com/o19s/quepid/pull/823 by @jeffryedvm.  Thanks!

* Some folks, like @jeffryedvm, really want to know the rank of the document when judging it in the Books interface.   https://github.com/o19s/quepid/pull/822 by @epugh implements request https://github.com/o19s/quepid/pull/823 by @jeffryedvm.

* Want to use the Snapshot capablity to import your case with it's queries with it's documents and all of it's document fields?  Now you can!  https://github.com/o19s/quepid/pull/821 let's you export a snapshot with any recorded document fields.   You can also now import them. https://github.com/o19s/quepid/pull/821 by @epugh for @mkr.

* We're finding anonymous ratings in our Books, and it's a pain.  https://github.com/o19s/quepid/pull/819 lets you remap anonymous ratings and judgements to a specific user.  Thanks @david-fisher for identifying the issue.



## 7.7.1 - 2023-08-31

For folks who have been using Quepid prior to 7.6.0, they will have lots of ratings from the main Cases screen that are anonymous, because we didn't associate a user with the ratings.   If you now import those ratings into a Book of Judgements, you will have to rerate them if you chose the "multiple raters" options, because you are different than the anonymous user.   We have added on the edit book screen an option to map anonymous ratings to a specific user in both a Book and it's associated Cases to support the migration.

https://github.com/o19s/quepid/pull/819 lets you remap anonymous ratings and judgements to a specific user.  Thanks @david-fisher for identifying the issue.

## 7.7.0 - 2023-08-31

We finally have a brand new homepage!  Quepid started as a tool for relevancy engineers only, but today we have human judges using Quepid to rate documents, Search Managers who are keeping an eye on the offline metrics, and of course in more complex setups, networking types who configure the connection between Quepid and the Search Engine.   In the past, regardless of who you were, we dropped you right into a Case.  If you had never created one before, well, you got shoved into the Case creation wizard, whether you wanted it or not.   It made for a unpleasant first experience for anyone other than the hard core relevancy engineer.   

The new dashboard is an attempt to change that UX.  It's just a first cut, and honestly, it probably doesn't quite make anyone perfectly happy.   I'm hoping that we can get a lot of good feedback and learn from it.   I could imagine in the future that based on what you do, we surface information you care about.  For example, a network engineer would want to know that the Quepid can talk to each Search Engine.   A Search Manager would be more interested in insights and summary progress information.   Human judges want to know "what is my next task to do".   So please share feedback!

### Features

* New home page (and sidebar!) in https://github.com/o19s/quepid/issues/681 is added via https://github.com/o19s/quepid/pull/684 by @epugh.

### Improvements

* The feedback message after creating an empty book is now smart about if there are related cases or not, and gives better next steps instructions.  https://github.com/o19s/quepid/issues/796 by @OkkeKlein fixed by https://github.com/o19s/quepid/pull/797 by  @epugh.  Thanks Okke!

* The Cases listing page shows your cases from oldest to newest.  @atarora opened https://github.com/o19s/quepid/issues/708 for sortable columns.  Implementing this didn't go well, so as an alternative, changed the sorting to be from newest to oldest, taking into account the case update time as well as the last time you viewed a specific case.  https://github.com/o19s/quepid/pull/795 by @epugh.  We may want to redo the entire Cases listing page at some point....  Hopefully this is better @atarora ;-).

* Reworked the messageing (and error handling) when you attempt to open a case that hasn't been shared with you (or doesn't exist!).   We had been showing the "You need to reload Quepid in the HTTPS" type message, when actually it was a "Make sure this case has been shared with you!" situation.  Also reduced the amount of error messages in the browser and the server in this situation by being smarter.  Thanks @cmorley for surfacing this.  https://github.com/o19s/quepid/issues/792 by @epugh fixed by https://github.com/o19s/quepid/pull/793.

* Thumb images can use a `prefix_url`, just like regular images.  https://github.com/o19s/quepid/issues/790 by @OkkeKlein is fixed in https://github.com/o19s/quepid/pull/805 by @epugh.

* Using Nginx and have huge documents being snapshotted etc.  New configuration suggested by @OkkeKlein allows Nginx to be happy.  https://github.com/o19s/quepid/pull/804 by @epugh.

### Bugs

* Drop a link in Slack to team 3, and you see details about case 3;-).  https://github.com/o19s/quepid/issues/733 by @epugh fixed by https://github.com/o19s/quepid/pull/794 by @epugh to only do unfurling for cases.

* Ace code editor insists on loading two javascript files from specific paths in Quepid.  Despite best effort, couldn't change this.  So https://github.com/o19s/quepid/pull/793 just mounts those javascript where Ace wants it to shut up some very loud error messages in the browser console.  If you can't beat'em, join'em.  

* When judging ratings using the Book of Judgements, you could sometimes get a situation where you create a judgement, and then tried to create a new one, hitting a constraint.  https://github.com/o19s/quepid/pull/809 by @epugh makes this more robust.

* Guess what?  7 GB out of our 9 GB production database is scores for cases being inserted OVER AND OVER again!  The AngularJS app uses event emitting to signal when scoring is completed, this causes extra events to be triggered, causing extra PUT of the case scores.   This shouldn't matter as we have logic on the server side.  However, due to a bug, that logic doesn't actually work.  The unit tests for the front end and the back end each independently validate the logic, it's just when you put them together it doesn't work.  This didn't matter for years, but the new Dashboard surfaces scores ;-).  Fixed in https://github.com/o19s/quepid/pull/807 by @epugh.



## 7.6.1 - 2023-07-06

* Chased down bug with showing you the previous judgement on the Human Judgement page.  https://github.com/o19s/quepid/pull/779 by @epugh.

## 7.6.0 - 2023-07-05

Big overhaul on the human rating side of things.  We now roundtrip ratings that you have made from the core Case screen into your Book of Judgements when you populate it.   (We are also now tracking who the last person was to rate a doc in the Case screen).   You can now also merge ratings from multiple Book's into a new Book, which lets you reuse your judgements in new combinations.


Additionally, to encourage your human judges, a progress screen has been added every 20 judgements showing progress and a leaderboard.

* https://github.com/o19s/quepid/pull/778 by @epugh introduces some "fun" into the rating process ;-).  

* https://github.com/o19s/quepid/pull/766 introduced the synthesizing of a Book, and fixes https://github.com/o19s/quepid/issues/765, track who rates in the main quepid ui, https://github.com/o19s/quepid/issues/763, link from list of books in judgements to the book itself, and https://github.com/o19s/quepid/issues/761, Combining books loses judgments but still produces scores.  

* https://github.com/o19s/quepid/pull/760 changes Quepid to use floats for ratings and judgements, which opens the door to implicit judgements.



## 7.5.0 - 2023-06-15

Need to interact with Quepid API's from outside of Quepid?  We now support Personal Access Tokens!  From your Profile page you can generate your own token and then use that to authenticate against Quepid.  For example, you can programatically load a judgement directly into Quepid:
```
curl -X POST http://localhost:3000/api/books/2/judgements/ -H 'Authorization: Bearer 4a82040bf1b2d255c63833cb59fa9275' -H 'Content-Type: application/json' -d '{
  "judgement": {
    "query_doc_pair_id": 201
    "rating": 1
  }
}'
```
https://github.com/o19s/quepid/pull/759 and https://github.com/o19s/quepid/pull/756 by @epugh.

In support of this, we added new API's for judgements and ratings in https://github.com/o19s/quepid/pull/757 by @epugh.

### Bugs

* Exporting Ratings in CSV format was returning the same rating for every single rater, regardless of what they did!  Fixed in by @epugh with special help from @grahamwren.   I randomly sat next to him on plane flight home and we paired on it ;-).  

* Looking up the wrong info need for a Query Doc Pair!  Fixed in https://github.com/o19s/quepid/pull/755 by @epugh.

* Missed a relative path for the tries history visualization.  Fixed in https://github.com/o19s/quepid/pull/754.



## 7.4.1 - 2023-06-09

Lots of small things from working with Quepid using templates with OpenSearch.  Also, if you haven't used https://github.com/o19s/agent_q, it's been updated to work with Quepid 7.x line.   I use it to automate pulling my relevance metrics daily from Quepid cases ;-).

### Features

* Rework how we handle OS/ES templates in Quepid so that you don't need to append `/template` to the url, instead, use the existence of the `{"id":"my-template"}` in the query parameters to decide what URL to use.  This simplifies life when you are using a mix of templates and not since you don't need to change the url constantly.  This was mostly in the Splainer-Search v2.22, v2.22.1, and v2.22.2 releases. https://github.com/o19s/splainer-search/

* Now, under Explain Query modal, you can see the rendered template query for a specific query!  https://github.com/o19s/quepid/pull/751 by @epugh.

### Improvements

* Kind of in the weeds, but early database migrations in Quepid back in Rails 4 days didn't have a version spec.  Rails 7 complains about this.  https://github.com/o19s/quepid/issues/739 fixed by https://github.com/o19s/quepid/pull/746 by @epugh.

* Introduced a new environment variable `QUEPID_CONSIDER_ALL_REQUESTS_LOCAL` that lets you bubble up errors message in a production Rails environment, which is helpful in troubleshooting deployments when you can't see the logs.  https://github.com/o19s/quepid/pull/750 by @epugh.

* Package Jupyterlite to not require external network calls.  https://github.com/o19s/quepid/issues/721 by @epugh fixed by https://github.com/o19s/quepid/pull/728 by @mkr.

### Bugs

* A three point custom scorer should support keyboard shortcuts.  https://github.com/o19s/quepid/issues/738 by @epugh fixed by https://github.com/o19s/quepid/pull/752 by @depahelix2021.

* Missing Documents Modal doesn't work when an ES/OS Query Template is defined.  https://github.com/o19s/quepid/issues/747 fixed by https://github.com/o19s/quepid/pull/753 by @epugh.

* Populating a book of judgements would blow up.  Plus the data model allowed a single user to rate a query/doc pair multiple times, which was icky.  https://github.com/o19s/quepid/issues/734 fixed by https://github.com/o19s/quepid/pull/745 by @epugh.

* Use relative paths everywhere so when Quepid is behind proxies it works properly.  https://github.com/o19s/quepid/pull/754 by @epugh.

## 7.3.3 - 2023-05-30

* When populating a book of judgements, if the title field wasn't `title`, then it wouldn't show up with the correct name.   https://github.com/o19s/quepid/pull/737 by @epugh fixes this.

## 7.3.1 - 2023-05-26

* Fixed some additional API paths for use with a nested Quepid context.  https://github.com/o19s/quepid/pull/736 by @epugh.  Follow up to https://github.com/o19s/quepid/pull/719.  

## 7.3.0 - 2023-05-23

### Improvements

* Importing Snapshots was a feature from the dawn of Quepid, but @epugh had never used it till now.  Originally you had to put into the csv file the id of the Case you want to import into, which is awkward and error prone.  Now you can import a snapshot via the Import modal for a Case.  https://github.com/o19s/quepid/pull/727 by @depahelix2021 fixes https://github.com/o19s/quepid/issues/724 by @epugh.

### Bugs

* OpenSearch and Elasticsearch have a `_source` field that is nested JSON.  Turns out we don't support stringifying a JSON object in detailed exports or Snapshots.  https://github.com/o19s/quepid/pull/732 by @depahelix2021 fixes https://github.com/o19s/quepid/issues/730 by @epugh.  

* With the logic for matching Quepid TLS to the search engine TLS happening only via frontend logic (introduced in https://github.com/o19s/quepid/pull/719), we found the User Experience really rough.  https://github.com/o19s/quepid/pull/731 by @epugh reworks the UX to be clear about when you need to reload your Quepid.  

* We ship Jupyterlite for data manipulation, but maybe you don't have public network access? https://github.com/o19s/quepid/pull/728 by @mkr fixes https://github.com/o19s/quepid/issues/721 by @epugh.

* Cloning a Case loses the advanced settings.  https://github.com/o19s/quepid/pull/729 by @epugh fixes https://github.com/o19s/quepid/issues/725 opened by @jvia.  Thanks @jvia for reporting this!

## 7.2.1 - 2023-05-12

Well, that didn't take long...   Wanted to use the "Import Snapshot" function, and discovered that the "Export Snapshot" function was busted.   

### Features

* We've had the ability to mark a Case as "Public" for a while, but we only supported it for the visualization of tries screen.  As a spike, trial allowing public access to /api/cases/CASE_ID.json and /api/cases/CASE_ID/snapshots/SNAPSHOT_ID.json end points.  https://github.com/o19s/quepid/pull/723 by @epugh.

### Bugs

* Fix Export Snapshot.  https://github.com/o19s/quepid/pull/722 by @depahelix2021.

## 7.2.0 - 2023-05-11

### Features

* Interested in Rank Biased Overlap as a more powerful version of the venerable Jaccard metric?   We have it now as an example Jupter notebook.   Thanks to Tito Sierra at the 2023 US Haystack for introducing me to this metric.  Thanks to @mkr for creating the draft notebook.   

* Provide link to Team from Book of Judgements.  https://github.com/o19s/quepid/pull/718 by @epugh.

### Improvements

* Lots of fixes and cleanups for nesting Quepid under another domain in https://github.com/o19s/quepid/pull/719.   Credit to @frankcelia for figuring out that we were too smart by half in letting the Rails app redirect traffic to try and match Quepid TLS to the search engine's TLS.   Pulling that out has simplified our logic immensely.   https://github.com/o19s/quepid/pull/719 by @epugh and @frankcelia.

* We're now on Jupyterlite 0.1.0 from our relatively old 0.1.0b14, and have a build process that will let us stay up to date with this rapidly evolving project.  https://github.com/o19s/quepid/pull/709 by @mkr.

## 7.1.0 - 2023-05-05

### Features

Some bigger organizations deploying Quepid want to nest it under another domain, like https://tools.bigcorp.com/quepid instead of the more typical https://quepid.bigcorp.com.   @worleydl open a PR to support this eleven months ago, and now we finally have it over the finish line!  Just specify the `RAILS_RELATIVE_URL_ROOT` for when you want to nest Quepid under another domain. https://github.com/o19s/quepid/pull/500 by @worleydl.

### Improvements

* Custom scorers are sorted by the order from oldest to newest in the modal picker UI.  Instead, lets sort them alphabetically.  https://github.com/o19s/quepid/pull/717 by @epugh fixes https://github.com/o19s/quepid/issues/695.

* `teamSvc` unit test was failing a lot, and now has been dealt with...   By ignoring the checks.  :-(.

* When creating a new Book of judgements, seed the Scorer with the one from the Case you were using.  https://github.com/o19s/quepid/pull/716 by @epugh fixes https://github.com/o19s/quepid/issues/705.

### Bugs

* Using templates in OpenSearch (and Elasticsearch) clashes with how we display (or hide) the fieldSpec field.  https://github.com/o19s/quepid/pull/706 by @mkr fixes https://github.com/o19s/quepid/issues/699.

* The "Find Missing Docs" UI doesn't actual work with OpenSearch.  https://github.com/o19s/quepid/pull/707 by @mkr fixes https://github.com/o19s/quepid/issues/700.   Nicer help text as well.

* Generated link to individual OpenSearch (and Elasticsearch) document changed, and didn't render properly.  https://github.com/o19s/splainer-search/pull/117 by @mkr fixes https://github.com/o19s/quepid/issues/701.

* Swapping from one Scorer to another Scorer would lose the labels in the popup window.  https://github.com/o19s/quepid/pull/717 by @epugh fixes https://github.com/o19s/quepid/issues/704 and https://github.com/o19s/quepid/issues/696 by @epugh.  It may also fix https://github.com/o19s/quepid/issues/613 by @atarora ;-).   



## 7.0.0 - 2023-04-24

Are you ready to launch a [Human Rating Program](https://haystackconf.com/2019/human-judgement/)?   Quepid is now finally able to support you and your fellow human judges in gathering explicit ratings on your search results.

Since the dawn of Quepid, we've suffered from an _ahem_ sub optimal rating interface for gathering human judgements.

The rating interface failed most best practices for human rating, including suffering from position bias by listing documents in the order the search engine returned them, only supporting a single rating per query/doc pair, requiring lots of mouse movement and clicking.
All that, and the UI is a combination of features required for a Relevancy Engineer with those of a Human Judge.  
It's enough to make you weep.  
Just to make life harder, the rating interface requires a live connection to your search engine, which often required additional technical hoops to be jumped by your decidedly untechnical subject matter experts.

However that is no longer the case!

![Quepid Human Rater Interface](./docs/rating-card-interface.png)

This rating interface features:
 * You can have up to three independent ratings for every query/doc pair, opening the door to interesting measurements of rating quality.
 * A static dataset for rating that is populated from your live search engine.  Now your set of query/doc pairs won't change over time unless you want them to.
 * Query/doc pair are randomly sampled, but with a bias in favour of higher positioned results over lower positioned so you can get to meaningful numbers quicker.
 * Ability to mark a query/doc pair as "I can't Rate This Document" so we can find edge/confusing cases.
 * You control what shows up on the card using the same display configuration as in your typical Quepid case.
 * Supports thumbnails and hero images in the card.
 * There are Scoring Guidelines for your Raters to understand what the scoring scale means.

 To make the life of a Relevancy Engineer better, you can now import your queries and ratings from a _Book of Judgments_.
 Indeed you can roundtrip from a Case with query/doc pairs to a Book of judgements, get them rated, and then import then back into your Case.

This work was inspired by the great work that the folks at the Wikimedia Foundation did on Discernatron, their human rating tool.

Quepid is now the big 7.0!  There have been 98 PR's since release 6.14.0.  We are now running on Rails 7, which is great for opening the door to future improvements and keeping us from accumulating tech debt.   This also means we took the opportunity to bump the versions of Redis and MySQL we use, as well as Node, Ruby, and all the other libraries.  We're now on a modern infrastructure everywhere except for the Relevance Engineer's UI which is still on AngularJS.

Do back up your data before doing this upgrade!  Normally I'm pretty cavalier about updates in Quepid-land, but this changes a lot of things, including the MySQL version from 5.6 to 8....   So please back up your data, and for good measure, use those export options to export your precious ratings that you've collected.

Below are details on some selected PR's.

### Features

 * As mentioned above, the human rater interface is a big feature.  There are too many PR's and Issues to call them out individually.  However, I do want to thank everyone who contributed to that really important feature.  You know who you are!

 * Allow a Case to be marked Public to facilitate sharing analytics.  Public cases don't require you to log in for certain screens.  https://github.com/o19s/quepid/pull/595.

 * Jupyter notebook for calculating Jaccard Similarity between Snapshots.  https://github.com/o19s/quepid/pull/586 by @atarora.

 * Add Reciprocal Rank as a default Scorer.   https://github.com/o19s/quepid/pull/525 by @david-fisher.

### Improvements

* Rails 7 Upgrade!  This would be enough to move us from Quepid 6 to Quepid 7 by itself.  Turned out to be pretty painless upgrade.  Most of the work was in https://github.com/o19s/quepid/pull/627.

* We enabled RenovateBot to provide automatic PR's for dependencies.  In the past three months we had a flood of dependency updates, which improves our security profile and helps us deal with tech debt by ensuring we aren't falling behind.

* Refactor to remove manualMaxScore and manualMaxScoreValue from custom scorers as not used.  https://github.com/o19s/quepid/pull/609.


## 6.14.0 - 2022-11-22

### Improvements

* Rework the selection of settings for a search engine so that we are smarter about if you pick a TMDB demo server, use great defaults, but if you are picking your own search engine, then we make fewer assumptions about query structure, which reduces the chance the first query will blow up!  This was first identified by @macohen as part of https://github.com/querqy/chorus/issues/129.   Tracked as https://github.com/o19s/quepid/issues/580 by @epugh and fixed in https://github.com/o19s/quepid/pull/582,

### Bugs

* Command line tool `thor import:ratings` didn't handle a csv file with a header row.  Now filters off the header row.  Thanks @wrigleyDan for spotting this problem.  https://github.com/o19s/quepid/issues/581 by @epugh and fixed in https://github.com/o19s/quepid/pull/583.  

## 6.13.0 - 2022-10-28

It's my sister Megan's birthday :birthday:, so I figured I would give her a release of Quepid.  Happy birthday Megan!

There is so much to celebrate in this release, however I have to call out adding support for OpenSearch, enabling API keys to work with Elasticsearch, and the first release supporting Jupyter notebooks runing in Quepid!

### Features

* Quepid now supports OpenSearch!  https://github.com/o19s/quepid/issues/319 was opened 18 months ago by @flaxsearch, and contributed to by @DmitryKey.  Huge thanks to @mkr for stepping up and adding the support to both `splainer-search` and Quepid in https://github.com/o19s/quepid/pull/559.

* Quepid now supports Elastic Cloud and Elasticsearch auth with API Keys!   Thanks to the work by @aditya-kanekar in https://github.com/o19s/quepid/pull/563 and then extended by @worleydl in https://github.com/o19s/quepid/pull/566.   @aditya-kanekar also wrote up the docs on https://github.com/o19s/quepid/wiki/Troubleshooting-Elastic-Cloud-and-Quepid for how to set up Elastic Cloud!

* Jupyter Notebooks In Quepid :confetti_ball:. Everyone wants to customize their analytics and have different visualizations, so let's make that easier.  Quepid now integrates [Jupyterlite](https://github.com/jupyterlite/jupyterlite), a in browser version of Jupyter.  So you can write your notebooks using the Python you know and love, and not have to worry about installing dependencies, as Quepid ships all the typical ones.  This is an area that I expect a lot of improvement and change as we get to know how to ship sample analytics as Jupyter notebooks.  https://github.com/o19s/quepid/pull/544 by @epugh.

* Our first sample notebook let's you compare the scores of two snapshots using a histogram.  Really drives home the "before and after" story of Relevance Tuning.  To support this notebook, we needed to preserve the score and if all the docs are rated in the snapshot datastructure.   https://github.com/o19s/quepid/pull/550 by @epugh.

* Snapshots now include the total number of results for a query, useful for analytics.  Also expose the Quepid API for looking up snapshots in the snapshots modal UI.  https://github.com/o19s/quepid/pull/553 by @epugh fixes https://github.com/o19s/quepid/issues/539 by @renekrie.

* Curious what version of Quepid you are running?  So are the rest of us!  Display the Quepid version number in the page footer, https://github.com/o19s/quepid/issues/570 by @jzonthemtn is fixed by https://github.com/o19s/quepid/pull/576 by @epugh.

### Improvements

* We've moved away from the "master" terminology to "main" for the default code branch, and updated links for that.

* Moved to Ruby 3!   Ruby 3.1.2 on Bullseye is apparently twice as fast as Ruby 2.  These two changes let Quepid run on Apple Silicon.   It also lets us simplify our Dockerfile setup for Chromium, which we use for testing our frontend application.  Lastly, we ripped out Webpacker (Webpack).  Webpacker was added for JS toolingduring our migration to Rails 6, however we never actually used it in our development tooling, and is no longer preferred as part of Rails 7.  https://github.com/o19s/quepid/pull/558 by @epugh and @mkr.

* Integrate updating of database schema annotations into build processes.  This leverages the `annotations` gem, which we've had for years, but wasn't documented and therefore wasn't being manually run.  https://github.com/o19s/quepid/pull/555 by @epugh.

* When we first moved to Rails from python, we had various database table constraints that were not enforced.  Over the years we've started enforcing them, but never cleaned up the old data, till now!  https://github.com/o19s/quepid/pull/552 by @epugh.  Mostly of interest to folks with a deployment of Quepid back to 2016 ;-).

* During the Rails 6 migration we found out Redis wasn't critical to running Quepid, and attempted to make it optional.  However that turned out to be confusing, and future features will __require__ Redis.  So let's put it back in our default production docker compose setup.  https://github.com/o19s/quepid/pull/557 by first time contributor @OkkeKlein.  Thanks!

### Bugs

* Number of results to show is not preserved when cloning a case.  https://github.com/o19s/quepid/pull/578 by @epugh fixes https://github.com/o19s/quepid/issues/565 submitted by @MassimilianoUngheretti-TomTom.  

* Occasionally the Case snapshot isn't successful and there is no snapshot status information displayed to the user.  https://github.com/o19s/quepid/pull/569 by @atarora fixes https://github.com/o19s/quepid/issues/568, also by @atarora.

* The Snapshot Comparison Jupyter notebook doesn't show the number of results found.  https://github.com/o19s/quepid/issues/571 fixes https://github.com/o19s/quepid/pull/572, both by @atarora.

* If your `TC_URL` isn't defined, then that causes Quepid to blow up.  https://github.com/o19s/quepid/issues/573 by @jzonthemtn is fixed by https://github.com/o19s/quepid/pull/575 by @epugh.

* `docker-compose.prod.yml` is out of date and needs Redis and Nginx.   https://github.com/o19s/quepid/pull/557 by @OkkeKlein fixes https://github.com/o19s/quepid/issues/554.

* Changing Search Engines doesn't reset the api_method, so you could have ES attmepting to use JSONP, which is Solr specific.  https://github.com/o19s/quepid/issues/560 opened by @epugh fixed by https://github.com/o19s/quepid/pull/559 by @mkr and @epugh.

## 6.12.1 - 2022-08-11

### Bugs

* "Show Only Rated" feature in Quepid busted for ES. Highlighting on _id after a terms match in ES causes a index out of bounds exception. Also, the API method in explainOther needed to have the right case, might make a constants file at some point. https://github.com/o19s/splainer-search/pull/109 by @worleydl fixed the issue in Splainer.  Bumped in Quepid via https://github.com/o19s/quepid/pull/547 by @epugh.

## 6.12.0 - 2022-08-09

### Features

* Search box (to find queries).  https://github.com/o19s/quepid/pull/506 and https://github.com/o19s/quepid/pull/512 by @epugh fixes https://github.com/o19s/quepid/issues/493 by  @theaaronposc.  Thanks Aaron!

* You can now generate a new Case through the `thor` command line tools, useful when setting up lots of cases or as part of a script.   https://github.com/o19s/quepid/pull/533 by @epugh.  

* Surface how many unrated documents you have for a query as an alert bubble.  https://github.com/o19s/quepid/pull/532 by @epugh.

* The Frog Pond Report tells you about the state of your ratings.   Understand the distribution of queries that need ratings and decide if you need to "hop to it" ;-).  https://github.com/o19s/quepid/pull/526 by @epugh.

* Create missing queries when importing ratings.  https://github.com/o19s/quepid/pull/509 by @epugh.

### Improvements

* Gray out Queries with no ratings.  Previously they showed up as Red with a 0.0 score, the same as if everything had bad ratings!  https://github.com/o19s/quepid/pull/516 by @worleydl and suggested by @renekrie.

* Keycloak Version 17 changed the default url to not have the `/auth` in the namespaces.  https://github.com/o19s/quepid/pull/536 by @epugh fixes https://github.com/o19s/quepid/issues/528.   We now test Quepid with Keycloak 18.

* Average Precision Scorer AP@10 wasn't implemented following the most common definition of AP.  https://github.com/o19s/quepid/pull/535 by @david-fisher fixes this!  Thanks David!

* Taking a Snapshot is intensive process that makes a unique query to the search engine.  https://github.com/o19s/quepid/pull/513 by @epugh provides nicer error message.

* Remove some more unused AngularJS code.  https://github.com/o19s/quepid/pull/529 by @epugh.

* 'Information need' import doesn't works for an empty case.  https://github.com/o19s/quepid/pull/508 by @epugh fixes https://github.com/o19s/quepid/issues/507 by @atarora.

* Bump to latest Rails to pick up CVE fixes, Ruby 2.7.6 recommended by Heroku, Bundler 2.3.18, plus general updates to gem dependencies.

### Bugs

* The detailed export of the case doesn't exports the 0 documents matching queries.  https://github.com/o19s/quepid/pull/504 by @atarora fixes https://github.com/o19s/quepid/issues/501.

* Move the logic for the default ES and Solr server definitions from server AND client side to just client side.  https://github.com/o19s/quepid/pull/505 by @epugh fixes https://github.com/o19s/quepid/issues/503.

* Limited encoding renders snapshots unusable.  https://github.com/o19s/quepid/pull/510 by @epugh fixes https://github.com/o19s/quepid/issues/499 by @KennyLindahl.  Thanks Kenny for the analysis!

* Fixed missing query fields from cloning a case.  https://github.com/o19s/quepid/pull/520 by @epugh

## 6.11.0 - 2022-04-23

### Features

* Documenting the explicit Information Need of the user is a core part of running human judgements, and historically people used the Notes field for this.   Now we have a Information Need attribute for every Query, and you can import/export that data via CSV, as well as edit it in the UI.  Mouse over the query to see exactly what the user is trying to do!  https://github.com/o19s/quepid/pull/480 by @epugh.

* The details of a specific query exposed by the Explain Query modal is in a Human readable format, but isn't in a JSON compliant format.   Now we sort the keys alphabetically, which helps the user dig through the details, and have a Copy as JSON button so you can use other tools to look at the JSON information.  https://github.com/o19s/quepid/pull/497 by
@epugh fixes https://github.com/o19s/quepid/issues/492.

* Delete All Queries for a Case was requested by @negyesi in https://github.com/o19s/quepid/issues/475.   At the case level added a Delete button that brings up a modal that lets you delete the case, archive the case, or delete all the queries.  https://github.com/o19s/quepid/pull/486 by @epugh.

* Frustrated that your custom API that _looks_ like Solr to Quepid has to deal with JSONP callbacks?  Now you don't, as we have introduced the ability to swap from the default JSONP to GET api methods when you define your Solr end point.  This is going to simplify the work that folks have to do.   https://github.com/o19s/quepid/pull/495 by @epugh.  For more information refer to the docs at https://github.com/o19s/quepid/blob/main/docs/endpoints_solr.md#solr-endpoints-structure.

* Do you have a relative image url in your search engine that you want to show via `thumb:` or `image:`?   You can now provide some JSON in the field specification to provide that data: `id,title:title,{"name": "image_url", "type":"image", "prefix": "https://www.example.org/images"}, description`.   This feature is experimental as we learn more about how to have richer field specifications, and may change!  https://github.com/o19s/quepid/pull/487 by @epugh.

### Improvements

* The link to view a single Solr document specifies XML, which I realize is a very _OK boomer_ approach these days!  https://github.com/o19s/splainer-search/pull/107 by @begomeister fixes https://github.com/o19s/quepid/issues/494 by swapping to JSON format instead.

* github.com/teleborder/FileSaver.js repo disappeared, so migrate to an actual published node module `file-saver` instead.  https://github.com/o19s/quepid/pull/498 by @epugh.

* We had a mish-mash of `query` and `query_text` as headers in our CSV files, so we've standardized on `query` to make export/import simpler.  https://github.com/o19s/quepid/pull/489 by @epugh.

* We discovered that Redis was ONLY used in Quepid to support sending events to Google Analytics!  If your `QUEPID_GA` isn't specified, then Redis is no longer required.  Thanks to @rbednarzCBI for updating the production docker settings to remove Redis in https://github.com/o19s/quepid/pull/488.

* preserve search engine type when swapping protocol, don't default to Solr!  https://github.com/o19s/quepid/pull/459 by @epugh.

### Bugs

* The various CSV upload and export features didn't really handle `,` in the text properly, so we gave that a good going over.  https://github.com/o19s/quepid/issues/482 by @atarora fixed by https://github.com/o19s/quepid/pull/483 and https://github.com/o19s/quepid/pull/485 by @epugh

* Tracking the history of your tries, we had a limit in the database that prevented you from having lots of tries.  https://github.com/o19s/quepid/issues/478 by @KennyLindahl and https://github.com/o19s/quepid/issues/470 by @korlowski.   Fixed by https://github.com/o19s/quepid/pull/479 by @epugh.  Thanks @KennyLindahl for the additional testing work you did to help me fix this!

* Fixed the ability to peek at the next page of result when you have less then 10 results left.   Thanks @anegyesi for submitting https://github.com/o19s/quepid/issues/473 and fixed in https://github.com/o19s/quepid/pull/496.

* Noticed the case level graph isn't useful?  PR https://github.com/o19s/quepid/pull/491 by @worleydl, Save scores less often, fixes stretching of graph, fixes this.

* @thePanz opened a ticket a year ago (https://github.com/o19s/quepid/issues/330) about ratings getting progressively slower in the UI, and a huge amount of updates to the backend.  Thanks to @worleydl and https://github.com/o19s/quepid/pull/490 this _should_ be fixed.   



## 6.10.1 - 2022-02-28

### Bugs

* Updated Splainer-Search to https://github.com/o19s/splainer-search/releases/tag/v2.13.0 to enhance snapshots with ES, and make our parsing of ES.

* When Quepid switches between HTTP and HTTPS protocols, the flash message "Reloaded on HTTP protocol for Quepid app to match search engine URL" causes some CSS layout issues which led to the "Run my Queries" button to slide off the page!   Darn you CSS.  First spotted by @nathancday, while giving a demo of course!  Fixed by https://github.com/o19s/quepid/pull/463 by @epugh.

* When reloading from HTTP to HTTPS Elasticsearch during the case wizard, we lose the default query params for ES, we end up
with the default Solr query params!  https://github.com/o19s/quepid/issues/457 by @epugh and @wrigleyDan.  Fixed by https://github.com/o19s/quepid/pull/464 by @epugh.

* Build was failing for Apple Silicon M1 users!  https://github.com/o19s/quepid/issues/430 by @llermaly and fixed by @wrigleyDan via https://github.com/o19s/quepid/pull/460.

* Missing doc" error when comparing with snapshot in Elastic when using non standard Id, https://github.com/o19s/quepid/issues/466 by @KennyLindahl fixed by splainer-search 2.13.0.


## 6.10.0 - 2022-01-03

We've taken a rag and polished up the _Find and Rate Missing Documents_ modal box in this release.   We've also completely
redone how we attempted to handle http and https connections from Quepid to http and https search engines that was first
introduced into 6.9.0 based on what we've learned in the real world.

### Improvements

* Reworked the handing of http and https connections to Quepid when connecting to http and https search engines.  Added in Development mode a nginx based proxy to make http://localhost/ and https://localhost/ work, which is also how you would deploy Quepid in a Production set up.   Still works fine on http://localhost:3000 if you only use http based search engine connection.   Big thanks to @jzonthemtn for https://github.com/o19s/quepid/pull/451 which fixes https://github.com/o19s/quepid/issues/444 and https://github.com/o19s/quepid/issues/438.


* The _Find and Rate Missing Documents_ query interface assumes you use the Lucene query syntax.  Turns out we have a highlighter built in, so enable that for Lucene syntax.  https://github.com/o19s/quepid/pull/453 by @epugh.

* Writing your own scorer?   The modal popup window is rather cramped, so let's give the editor room to breathe by making them larger!   https://github.com/o19s/quepid/pull/452 by @epugh.

* In the early days of Quepid, looking up a single Solr doc would trigger a `facet.field` on every field you display in Quepid.  For some Solr's, this can turn a quick lookup for a single document to a 30 second or more ordeal because of unexpected faceting!  Thanks to @jeffryedvm for opening https://github.com/o19s/quepid/issues/442.  Fixed by https://github.com/o19s/quepid/pull/456 by @epugh.

### Bugs

* On the _Find and Rate Missing Documents_ screen the ability to show just the rated documents had an issue that you had to click the button twice, making you think it was broken.  https://github.com/o19s/quepid/issues/454 and https://github.com/o19s/quepid/issues/423 by @epugh are fixed in https://github.com/o19s/quepid/pull/455 by @epugh.


## 6.9.1 - 2021-10-27

### Improvements

* Splainer-search 2.11.0 handles nulls the same as empty arrays (_{ }_) in Solr output.  Nulls might happen when a Proxy is used.  https://github.com/o19s/quepid/pull/440 by @epugh fixes issue discovered by @mkr in https://github.com/o19s/splainer-search/issues/97.

* Node 15 is not a LTS version, which leads to a warning message!  https://github.com/o19s/quepid/pull/437 by @epugh bumps this.


## 6.9.0 - 2021-10-27

### Features

* Chrome 94 forces you to be on https URL to access HTTPS secured search engines.  Quepid now checks to see whether it is running on the same protocol, HTTPS or HTTP that the search engine is running on, and if not, prompts you to reload the app on the same protocol as the search engine.  This required updating the messenging in the Case Wizard and the Tune Relevance screens.   We also simplified the logic in the `home_controller.rb` around bootstrapping a Case and Try.  Thanks to @tboeghk for pairing with @epugh on how to solve this problem.   https://github.com/o19s/quepid/pull/431 by @epugh fixes https://github.com/o19s/quepid/issues/426 by @DmitryKey and https://github.com/o19s/quepid/issues/432 by @bbirrell.

### Improvements

* Remove remnants of "SecureApp" angular1 app that was refactored a while ago into regular Rails app for login screens.  https://github.com/o19s/quepid/pull/434 by @epugh fixes https://github.com/o19s/quepid/issues/433.

* Logic to enable Google Analytics tracking was crufty and caused classloader issues in development mode.  https://github.com/o19s/quepid/pull/419 by @epugh fixes https://github.com/o19s/quepid/issues/418.

## 6.8.0 - 2021-09-28

### Features

* Understand the evolution of your various Tries by visualizing the history as a tree data structure.  Understand where you went back to an earlier Try and branched off in new directions.  https://github.com/o19s/quepid/pull/412 by @epugh fixes https://github.com/o19s/quepid/pull/412 by @DmitryKey.

* Deploying Quepid in a cloud native way requires having a *healthcheck* end point to confirm Quepid is available and happy.  https://github.com/o19s/quepid/pull/404 by @epugh fixes https://github.com/o19s/quepid/pull/404 by @mkr.   Thanks to @xaviersanchez for the inspiration to do this.

* Now sort queries by most recently modified.  https://github.com/o19s/quepid/pull/334 by @DmitryKey and @epugh fixes https://github.com/o19s/quepid/issues/307.

* Excited to share the improvements you made to your Case?  You can now drop your link to the Case into Slack or other messaging tools, and it will _unfurl_, i.e show the Case Name and the most recent Try number.  You will still need to log into Quepid and have access to that Case.  https://github.com/o19s/quepid/pull/417 by @epugh fixes https://github.com/o19s/quepid/issues/416.

### Improvements

* The messaging around how many documents are being scored, i.e `@10` or `@40` is now driven by the variable `k` defined in various Scorers.  Commit 73a378f9bae777cb504618cdc3361bfec52ff82f by @epugh fixes https://github.com/o19s/quepid/issues/413 by @DmitryKey.

* We audited our Docker builds, and _*shrank* the images from 2.42GB to 1.44GB!   Bumping Node version to 15, be smarter about what folders we copy into our production image, and some general fixups.  https://github.com/o19s/quepid/pull/409 by @dworley and @epugh.

* The logic to check if Google Analytics is enabled via ENV variable is different then the normal Quepid ENV handling.  https://github.com/o19s/quepid/pull/419 by @epugh cleaned this up, and solves a class loading issue in the DEV mode Quepid, increasing developer happiness!

* Trying to find a doc that SHOULD match and be rated, but can't find it?  Using a global scorer like NDCG and curious what all the ratings are?   We have reworked the _Explain Missing Documents_ UI into a _Find and Rate Missing Documents_ that lets you see all your ratings associated with a query, and then search and find other documents that are missing.  Preview video here https://share.descript.com/view/IkxWkjSzzKF. https://github.com/o19s/quepid/pull/407 by @epugh fixes https://github.com/o19s/quepid/issues/406 by @mkr.


## 6.7.0 - 2021-08-26

### Features

* Elasticsearch fields computed using script query now work!  Back in February @CGamesPlay contributed a PR (https://github.com/o19s/splainer-search/pull/90) to `splainer-search` to support this, and now it automagically works in Quepid! Thanks @DmitryKey for opening https://github.com/o19s/quepid/issues/327 and supporting this feature.  

* Elasticsearch templates can now be used in Quepid!  https://github.com/o19s/quepid/pull/400 by @epugh exposes the underlying `splainer-search` functionality in Quepid. Thanks @danielibars for opening https://github.com/o19s/quepid/issues/274 and supporting this feature.  

* Curious what parameters are being used by Solr to construct the query?  We're now adding a  `echoParams=all` to queries and surfacing them in the _Explain  Query_ modal at the query level in Quepid.  Currently a  Solr only feature.  https://github.com/o19s/quepid/pull/397 by @epugh with inspiration from @mkr.

### Improvements

* Continue cleanup of JavaScript, eliminated last remnants of "unit test" style scorers, and renamed `customScorer` to just `scorer` in front end app.

## 6.6.1 - 2021-08-11

* In testing the Keycloak oAuth integration via the Chorus project, identified that the name of the _Client_ that is passed to Keycloak was tied to the `KEYCLOAK_REALM` env setting.   Changed this to be hardcoded to `quepid` so it can be different then the _Realm_ name (i.e the Realm is _Chorus_ in the Chorus project, and the Client is _quepid_).  Commmit de9e0e645ddb4cb02644680ed8af456a167023dd by @epugh.

## 6.6.0 - 2021-08-09

### Features

* OpenID Support!  Historically you had to create your own account on Quepid, but that is another barrier to entry, and something else to keep track of.  Inspired by the issue _Add OAuth Providers_ by @gregoryduckworth https://github.com/o19s/quepid/issues/188,  https://github.com/o19s/quepid/pull/280 and https://github.com/o19s/quepid/pull/389 by @epugh implements the first two providers, Google and Keycloak.

* Explain Query Parsing!  We often want to know what the search engine is doing to our query.  Now you can click the "Explain Query" popup and see what is happening to your query and the various filter queries.  This works with both Solr and Elasticsearch.   https://twitter.com/dep4b/status/1420480501710827520.   https://github.com/o19s/quepid/pull/391 by @epugh.

* Frequently type `deftype` instead of `defType` in Solr?  I found an old, but broken feature that provided a popup warning on common Solr query syntax errors, which has now been restored.   https://github.com/o19s/quepid/pull/394 by @epugh fixes https://github.com/o19s/quepid/issues/390.

### Improvements

* Quepid is running on Rails 6!  Rails 6 was released ~26 months ago, and represents the future of Rails.  I'm excited that this push initiated by @DmitryKey is going to bring us some great new features like: better developer experience with Webpack for JavaScript, ActionText to handle better text formatting of notes and messages about Cases and Queries, ActionCable which will let us notify all the users of the same case that data has changed when it changes.  https://github.com/o19s/quepid/pull/381 by @DmitryKey with assist from @epugh.

* Make our ActiveRecord modeling for ownership the same.  Teams have an _owner_, Scorers have an _owner_, but Cases have a _user_.  Now we have _case.owner_ relationship.  https://github.com/o19s/quepid/pull/359 by @epugh.

* The nav bar link for Scorers is labeled "Custom Scorers", and takes you to an page called `/advanced`.   Both of the names are rather offputting.   Creating Scorers is a normal common thing to do in Quepid, so lets label it Scorers.  https://github.com/o19s/quepid/pull/392 by @epugh fixes https://github.com/o19s/quepid/issues/351.

* We had, as someone put it "dinosaur" age CSS tags for mozilla and webkit browsers that triggered lots of browser warnings in the console.  https://github.com/o19s/quepid/pull/380 by @epugh cleaned up many of them.   It has also prompted some thinking about migrating to Bootstrap 5 for the non core pages.  If anyone has some CSS skills, please contact @epugh, to help refine the header menu in Bootstrap 5 CSS.  

### Bugs

## 6.5.5 - 2021-06-30

### Features

* You can now tag a field with `translate:`, as in `translate:content` and you will get an icon to pop the text open in a Google Translate in a new browser window.  https://github.com/o19s/quepid/pull/386 by @epugh.

### Improvements

* You can now export fields that have the formatting modifiers `thumb` and `image` using the detail format.  Also improved the handling of the General and Detail export from the Case Listing page.  https://github.com/o19s/quepid/pull/383 by @epugh fixes https://github.com/o19s/quepid/issues/382.  Thanks @DmitryKey for the improvement assist and spotting the Case Listing export issue.

* Admin user can now reset a users password with a new password.  https://github.com/o19s/quepid/pull/385 by @epugh to fix issue identified by @michaelcizmar.  Thanks Michael!

* Trying to communicate about HTTPS better when you set up a case.  https://github.com/o19s/quepid/pull/384 by @epugh inspired by https://github.com/o19s/quepid/issues/279 by @arafalov.



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

![favicon](https://raw.githubusercontent.com/o19s/quepid/main/app/assets/images/favicon.ico)

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
* If you link to either a case that doesn't exist, or you don't have permission for, or a try that doesn't exist for a case, then provide messaging back in the UI!  Let's share some Quepid Cases!  933ed257198ebe21ff86b7e35573d3172cc2e593, 99ac27c1f8698ed726580a4c46eaf6810a4372d2, and 37b95b89fa848b0af2bae3d5a9541141e5d80d62 by @epugh to main branch fixes https://github.com/o19s/quepid/issues/158.
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

There is a sql migration script in `./db/release_6_2_0_merge_default_scorer_into_scorer.sql` that you might want to look if you have been using Quepid locally for a while.  This script is primarily meant to support updating http://go.quepidapp.com database for the 6.2.0 schema.

QUEPID_DEFAULT_SCORER is a new environment variable specifying the name of the default scorer
for users when they create a new case. QUEPID_DEFAULT_SCORER=AP@10 is what go.quepidapp.com uses.

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
* NDCG@10 doesn't include documents that are rated via Explain Other, it only looks at the documents returned by the search engine.  We want to be able to have NDCG look globally at all rated documents.  https://github.com/o19s/quepid/pull/90 by @nathancday and @worleydl fixes https://github.com/o19s/quepid/issues/78.  Note: We currently have the NDCG@10 scorer in go.quepidapp.com, however it hasn't been backported to the Docker image or the dev setup in Quepid.  See https://github.com/o19s/quepid/issues/91.

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
* go.quepidapp.com needs to get explicit consent from users to receive emails related to Quepid and related features.   Introducing a new `customize_quepid.rb` file in initializers to start supporting more customizations of Quepid.  https://github.com/o19s/quepid/pull/68 by @worleydl.
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
