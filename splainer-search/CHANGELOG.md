Version numbers correspond to `package.json` version.  Follows the _major.minor.bugfix_ naming pattern as of 2.8.0.

# 2.32.0 (2024-02-07)
- Algolia support added!   Thanks @sumitsarker for the great contribution, https://github.com/o19s/splainer-search/pull/145.

# 2.32.0 (2024-02-06)
- Splainer lets you do smart things around using highlighting in the query and/or snippeting to 200 characters to take a really large document field and shrink it to something that renders nicely.  However sometimes you just want to see ALL the text.  So now in a field specification you can control that by specifing `unabridged:body_content` for your long form text fields.  https://github.com/o19s/splainer-search/pull/148 by @epugh.


# 2.31.0 (2024-02-05)
- When using Solr and proxing through Quepid, we require you to use a GET.  However, when doing a doc lookup (to power snapshot compare) it falls back to JSONP, instead of using the specified GET.  https://github.com/o19s/splainer-search/pull/146 by @epugh.

- POTENTIALLY BREAKING CHANGE!  Splainer-search has some logic around escaping queries.  For example `OR` becomes `\\OR`...  It is rather unclear if this is actually a fully baked set of logic, and has created some bugs like https://github.com/o19s/quepid/issues/910.   We've commented out the escaping in Splainer-search, added logging about it, but will leave the code, tagged with `SUSS_USE_OF_ESCAPING`.  Going to ship this in the next version of Quepid and get feedback from community on if there are regressions that warrant restoring some sort of escaping.  https://github.com/o19s/splainer-search/pull/147 by @epugh.

# 2.30.7 (2023-12-05)
- Support Custom Headers being passed through to Solr.  We have a nice refactoring of how headers are processed, and reusing the `esUrlSvc` in the `solrSearcherFactory`.  https://github.com/o19s/splainer-search/pull/143 by @epugh.  

# 2.30.6 (2023-11-30)
- It appears that the DocResolver is needed regardless of if you support it or not.  Weird stuff in Quepid otherwise happens.  https://github.com/o19s/splainer-search/pull/141 by @epugh rolls back the change.  Thanks @dacox for https://github.com/o19s/splainer-search/issues/140.

# 2.30.5 (2023-11-29)
- Looking up individual documents from the search engine (i.e the DocResolver) didn't respect the proxy settings.   Also found a bug in creating direct link to OpenSearch docs where you could get doubled `/_doc/_doc/` in the url!  https://github.com/o19s/splainer-search/pull/139 by @epugh.  Thanks @david-fisher for finding the snapshot with proxies issue.

# 2.30.4 (2023-11-27)
- Custom Headers can now be used with Search API's. https://github.com/o19s/splainer-search/pull/138 by @dacox.  Thanks Doug Cox!

# 2.30.3 (2023-11-16)
- Bug fix for arrays passed into query templating via `qOptions`. https://github.com/o19s/splainer-search/pull/137 by @mkr.
- Avoid the query object -> string -> hydrating -> string -> query object roundtrip and directly hydrate on the query object. https://github.com/o19s/splainer-search/pull/136 by @mkr.


# 2.30.0 (2023-11-14)
- Rewriting the query templating, allowing for query options hierarchical object to be passed into query templates as `qOptions`. https://github.com/o19s/splainer-search/pull/135 by @epugh and @mkr.

# 2.29.0 (2023-11-02)
- For custom `searchapi` we now track and store the response from the API for callers to look at.  Added new error handling around custom mappers so you can figure which are having issues.  https://github.com/o19s/splainer-search/pull/134 by @epugh.

# 2.28.0 (2023-11-01)
- Introduced a `httpProxyTransportFactory` that wraps the other `transporters` for when you want to send a request via proxy.  It is enabled by passing in your `settings` the value `proxyUrl:'http://myserver/proxy'`.  This works much better than the previous approach of managing the url with a proxy at the Quepid level.  https://github.com/o19s/splainer-search/pull/133 by @epugh.

# 2.27.0 (2023-10-25)
- In 2.26.0 we required you to specify a "responseParser" for a custom search api that was OS, ES, or Solr.  However, that was VERY limiting, and required you to return your search results from your custom search api in one of those formats.   We now have the concept of _mappers_, which are JavaScript code that converts from the JSON format that your API returns to the native JavaScript objects that splainer-search uses.  In this release we have `numberOfResultsMapper` and `docsMapper` mappers defined, and this will evolve.  https://github.com/o19s/splainer-search/pull/132 by @epugh.

# 2.26.0 (2023-09-22)
- To support a custom search api, we need to be able to override how the SettingsValidator does a ping by passing in our own arguments.  Not a perfect solution, but enables a MVP _searchapi_ to work in Quepid.  https://github.com/o19s/splainer-search/pull/131 by @epugh.

# 2.25.0 (2023-09-11)
- Fixed bug in pagination that didn't respect the `apiMethod` setting for Solr.  If you used GET, splainer-search sent the request as JSONP anyway, causing errors in the Browser.  https://github.com/o19s/splainer-search/pull/130 by @epugh.

- Vectara is the first Vector search engine to work with Splainer.  https://github.com/o19s/splainer-search/pull/128 by @mkr.


# 2.24.0 (2023-08-28)
- Support using a prefix for a image path for thumbnails, the same way we support it for images.  https://github.com/o19s/splainer-search/pull/127 by @epugh fixes https://github.com/o19s/quepid/issues/790 by @OkkeKlein.

# 2.23.0 (2023-07-05)
- Solr changed the explanation of the score when using multiplicative boost functions via boost parameter somewhere between Solr 4.6 and Solr 8.11.  https://github.com/o19s/splainer-search/pull/126 by @wrigleyDan fixes https://github.com/o19s/splainer-search/issues/125.

# 2.22.1 (2023-06-07)
- Turns out the URL we have been crafting for OS/ES for `_explain` is the very old format! https://github.com/o19s/splainer-search/pull/124 by @epugh fixes this.

# 2.22.0 (2023-06-07)
- Template calls to OS and ES previously required you to add a "/template" to the url in tools like Quepid.
However, by looking for an `id:` parameter in the query, we can identify when a template has been provide, and only then add the /template.  This will make the experience in Quepid smoother, and fix some issues where non template calls are sent and fail due to the OS/ES url having a trailing /template!  https://github.com/o19s/splainer-search/pull/122 by @epugh fixes https://github.com/o19s/quepid/issues/747.

- Simplified the unit tests be eliminating the old ES4 and ES5 distinct tests.  https://github.com/o19s/splainer-search/pull/121 by @epugh.

# 2.21.0 (2023-05-23)
- Urls to documents that have a document id with a `#` character embedded don't pass the id into OpenSearch and Elasticsearch.  We now escape that character to fool the browser ;-).  https://github.com/o19s/splainer-search/pull/120 by @epugh fixes https://github.com/o19s/splainer-search/issues/119.

- We also fixed a bug in how the urls for Elasticsearch 7+ and OpenSearch are formatted with the `/_doc/[id]` and `/_explain/[id]` pattern.   Splainer-search now only properly works with those search engines and above.  https://github.com/o19s/splainer-search/pull/120 by @epugh.



# 2.20.2 (2023-04-28)
- Urls that link to a individual document in OpenSearch and ES7+ have changed to have a `_doc` element in the path.  https://github.com/o19s/splainer-search/pull/117 by @mkr fixes https://github.com/o19s/quepid/issues/701.

- `npm outdated` highlights nothings.  All dependencies (barring this is Angular 1 ;-) ) are up to date.  https://github.com/o19s/splainer-search/pull/118 by @epugh.

# 2.20.0 (2022-10-13)
- We now support API keys!  Search engine deploys (like Elastic Cloud) are increasingly locked down, with an API Key being the most common way to access them.  Splainer-search now supports custom headers, which supports the api key usecase, and lays ground work for other use cases.   A huge round of thanks goes to @aditya-kanekar who created the first implmentation via https://github.com/o19s/splainer-search/pull/116, and then @worleydl for making it more generic.   This improvement will be surfaced into [Splainer](http://splainer.io) and [Quepid](http://quepid.com) asap.

- Splainer-search is ASL2.0 licensed, but there was a mismatch in package.json that said MIT.  Fixed this, and eliminated a old javascript `promise.js` implementation that isn't used in the library.  https://github.com/o19s/splainer-search/pull/115 by @epugh.

# 2.19.0 (2022-09-06)
-  Extract query performance timing data from Solr queries.  We already had access to the information, it just wasn't passed through the splainer-search layer.  https://github.com/o19s/splainer-search/pull/110 by @epugh.

- Dependencies clean up.   We were on very old testing infrastructure, and it was time to update.  https://github.com/o19s/splainer-search/pull/111 by @epugh with input from @david-fisher.

- Enable CI testing on CircleCI.  We used to use TravisCI, and then we used nothing!  https://github.com/o19s/splainer-search/pull/113 by @epugh.

- OpenSearch support!  https://github.com/o19s/splainer-search/pull/114 by @mkr.

# 2.18.0 (2022-08-11)
-  "Show Only Rated" feature in Quepid busted for ES. Highlighting on _id after a terms match in ES causes a index out of bounds exception. Also, the API method in explainOther needed to have the right case, might make a constants file at some point. https://github.com/o19s/splainer-search/pull/109 by @worleydl.

# 2.17.0 (2022-04-23)
- Links to view Solr document should return JSON formatted docs instead of XML.   _Ok boomer?_   https://github.com/o19s/splainer-search/pull/107 by @begomeister.
- Javascript linting!   https://github.com/o19s/splainer-search/pull/108 by @begomeister.

# 2.16.0 (2022-04-21)
- Introduce the ability to specify GET instead of the default JSONP method for talking to Solr.   Refactored to use the TransportFactory, similar to how we talk to Elasticsearch.   Baby step towards supporting Solr V2 API with POSTs.   https://github.com/o19s/splainer-search/pull/105 by @epugh.

# 2.15.0 (2022-04-12)
- You can supply a prefix for a image field type by using JSON: `id, title:tile, {"name": "relative_image_url_s", "type":"image", "prefix": "https://i.imgur.com"}`.   This will open up a lot of new ideas for managing your field specification.

# 2.14.0 (2022-04-05)
- Using Querqy with Solr?   We now return the `querqy_decorations` details in the `parsedQueryDetails` property.

# 2.13.0 (2022-02-21)
- Support an empty explanation hash in the response from either ES or Solr.   @A2Kashyap proxied a custom API to look like Elasticsearch response to Quepid, and therefore the explain output looked like `"_explanation": {}`, which we hadn't expected.  https://github.com/o19s/quepid/issues/465 by @A2Kashyap is fixed by https://github.com/o19s/splainer-search/pull/102 by @epugh.

- Handle both id field as `_id` (standard) and any alternative ID field in Elasticsearch when comparing Snapshots.  Issue opened by @KennyLindahl at https://github.com/o19s/quepid/issues/466 and fixed by @KennyLindahl via https://github.com/o19s/splainer-search/pull/101!

# 2.12.0 (2021-12-17)
- Links to individual Documents generated for Solr search engines (`doc._url()`) have faceting turned on for ALL of the fields listed.  This may be a feature to help you understand about a single document, however I don't quite have a use case that makes sense.  @jeffryedvm showed me it taking 30 seconds to query a single Solr doc due to what was blindly being faceted on, and opened https://github.com/o19s/quepid/issues/442.


# 2.11.0 (2021-11-05)
- Solr typically returns empty arrays in the response when it doesn't have data, however we have seen that people mocking up a Solr response might return a `null` instead of a `{}` array.  Now check that situation as well.

# 2.10.0 (2021-08-25)
- Return Solr query params in the `responseHeader.params` if they exist as `searcher.parsedQueryDetails`.
- Ran `npm audit` and upgraded dependencies.


# 2.9.0 (2021-08-20)
- Support Elasticsearch scripted fields in querying.  Thanks @dmitrykey for encouragement and testing.  Thanks to @CGamesPlay for the implementation via https://github.com/o19s/splainer-search/pull/90.


# 2.8.0 (2021-08-16)
- Support Elasticsearch templates in querying.   Any URL that ends in `/template` for Elasticsearch will be assumed to be a template query.  Thanks @danielibars for encouragement and testing.  https://github.com/o19s/splainer-search/pull/92 by @epugh.

# 2.7.0 (2021-07-28)
- Introduce to `searchFactory` the property `parsedQueryDetails` that stores details about the query
  being processed by the search engine.  Works with Solr and Elasticsearch.
- Using Querqy with Solr?   We now return the `querqy.infoLog` details in the `parsedQueryDetails` property.
- Upgrade JavaScript dependencies to be closer to what are used in the Quepid project.

# 2.6.11 (2021-06-30)
- Introduce translate:content field type (similar to thumb:image_url), that lets you tag which fields
  you want to translate.  We need to move this formatting logic over to Quepid instead of splainer-search ;-).

# 2.6.10 (2021-05-27)
- Introduce image:image_url field type (similar to thumb:image_url), but larger.

# 2.6.7-2.6.9 (12/16/2020)
- Solr - Disable highlight unless enabled in the fieldSpec

# 2.6.6 (12/09/2020)
- Allow full query override for ES explain other

# 2.6.4 (11/30/2020)
- Allow override of defType for explainOther in solr searcher

# 2.6.3 (10/21/2020)
- Fixed issue with documents having no title causing splainer to blow up.

# 2.6.2 (10/05/2020)
- Lots of work on breaking out highlighting into a better structure, after fighting with little fixes for a while.

# 2.5.9 (04/27/2020)
- Highlighting on dates and integers in Solr causes an error.  Work around is to append `hl.method=unified` to calls to Solr.  https://github.com/o19s/splainer-search/pull/84
- a common pattern in Solr schemas is to normalize fields with dots: `foo.bar`, however if you have a array or dictionary of JSON, we want to navigate that.  Now we check if the key exists with a dot in it, if not, we use that as a selector to pluck out the data in the nested JSON that we need.  https://github.com/o19s/splainer-search/pull/83

# 2.5.8 (04/16/2020)
- Fix rendering logic to handle Arrays and JSON objects so you don't get `"[object Object]"` in the UI. Another great fix by @CgamesPlay!
- Migrate to Puppeteer for browser testing.  No more PhantomJS.   Lots of other dependencies cleaned up, and some legacy files from when this was a full blown app instead of a library removed.  `package-lock.json` dropped from 9663 lines to 4788 lines.

# 2.5.7
- Allow http://username:password@example.com:9200/ in URL to work by converting to Authorization header for Elasticsearch.   Thanks @CGamesPlay for fix.

# 2.5.6
- Support extracting media fields that have fieldspec media:

# 2.5.5
- This time with the `splainer-search.js` file!

# 2.5.4
- DO NOT USE THIS VERSION, we missed the compiled file from the package ;-)
- Remove compiled `splainer-search.js` from github

# 2.5.3
- Explain Other on ES 6 and 7 Broken.
- Fix for wildcard fieldspec in ES, allow * as a fieldspec

# 2.5.2
_There was a hiatus up through 2.5.2 in maintaining this file._
- Remove Vagrant support from project.
- Support how ES 7 reports total docs found compared to how ES 6 and prior did.

# 2.2.3
- Bugfix: fixes bug when field name conflicts with url function name

# 2.2.2
- Bugfix: fixes formatting of json fields instead of returning [object Object]

# 2.2.1
- Bugfix: check for whether field name had a '.' was matching everything. D'oh!

# 2.2.0
- Adds support for neste fields

# 2.1.0
- Removes the requirement for a search engine version to support the different ways ES handles returning fields

# 2.0.5
- Support simple grouping in Solr

# 1.2.0
- Elasticsearch bulk search support

# 1.1.0
- Search validator to check URL for correct search results

# 1.0.0
- Elasticsearch support

# 0.1.10

## Bug Fixes

- Support for Solr URL's without a protocol
