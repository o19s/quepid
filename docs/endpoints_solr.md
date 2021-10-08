# Solr Endpoints Structure

This document explains what endpoints Quepid hits on Solr.

Most query responses are of type of JSON, wrapped in JSONP function name.

## Ping Solr During Case Setup

Quepid checks that that Solr is available and responding during the Case Setup Wizard, and if not
then Quepid attempts to provide you some workarounds.  You can bypass this check as well, and then
fix your connectivity setup yourself in the Case Settings window ;-).

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10&json.wrf=angular.callbacks._5
```

1. `q=*:*` is meant to be a query all docs, and is just to help you get a sample doc.  As long as you get one doc back, this is fine.
1. `fl=*` is to get a listing of fields back, for the UI in the Case Setup Wizard.
1. `wt=json` is to ensure the response is in JSON format that Quepid expects.

## Queries

Queries are sent off to Solr using the standard GET request handler.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=star%20wars&fl=id title&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10&start=0&json.wrf=angular.callbacks._2
```

Quepid adds some parameters:

1. `q=star%wars` comes from the Query Pane in the UI.
1. `fl=id title` comes from the Settings Pane in the UI.
1. `wt=json` is to ensure the response is in JSON format that Quepid expects.
1. `debug=true&debug.explain.structured=true` is used to get back the query explain information.  If this isn't available, that is fine, you just don't get the information about how the query matched the docs in the UI.
1. `echoParams=all` lets us return all the params used in constructing the query to show in the UI.  You can override this via passing in `echoParams=none`.
1. `hl=false` disables highlighting.  We used to actually use highlighting in our snippets, so this may be able to be removed.
1. `rows=10` is driven by the Settings Pane in the UI.
1. `start=1` is added when you start to paginate through the results.
1. `json.wrf=angular.callbacks._2` to avoid needing to use CORS, we use JSONP, which requires this parameter to be sent to Solr, and wraps the resulting JSON response in the function `angular.callbacks._2()`.  


## Find and Rate Missing Documents

This Modal UI in Quepid  has two query patterns for interacting with Solr.   The first is the ability for you to craft basic Lucene queries to go find some documents that then can be rated.  The second query pattern is to return ALL the documents that have been rated for a query, and is in the style of a lookup via list of id's for the documents.

### Find Documents
This function sends off whatever you enter to Solr using the standard GET request handler and expects a response type of JSON, wrapped in JSONP.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=star&explainOther=title:war&fl=id title poster_path overview cast&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10&json.wrf=angular.callbacks._8
```
1. `q=star` comes from the actual Query that you clicked Missing Documents button in the UI.
1. `explainOther=title:war` comes from the query you entered on the Find and Rate Missing Documents modal and is a Lucene query.   If you are building an adapter, you probably just want to search for the `explainOther` property.
1. `fl=id title poster_path overview cast` comes from the Settings
1. `wt=json` is to ensure the response is in JSON format that Quepid expects.
1. `debug=true&debug.explain.structured=true` is used to get back the query explain information.  If this isn't available, that is fine, you just don't get the information about how the query matched the docs in the UI.
1. `hl=false` disables highlighting.  We used to actually use highlighting in our snippets, so this may change.
1. `rows=10` is driven by the Settings Pane in the UI.
1. `json.wrf=angular.callbacks._8` to avoid needing to use CORS, we use JSONP, which requires this parameter to be sent to Solr, and wraps the resulting JSON response in the function `angular.callbacks._8()`.  

### List All Documents That Have Been Rated
This function sends off a query using the `{!terms}` component to look up the docs by their ids, using the GET request handler and expects a response type of JSON, wrapped in JSONP.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?qf=title%20id&rows=10&start=0&q={!terms%20f=id}193,13475&defType=lucene&fl=id title poster_path overview cast&wt=json&debug=true&debug.explain.structured=true&hl=false&json.wrf=angular.callbacks._z
```
1. `q={!terms%20f=id}193,13475` is the lookup by document id, in this case docs _193_ and _13475_.  This list will be as long as the number of rated docs.
1. `defType=lucene` changes the query parser to be specific to Lucene.  (Do we need it?).
1. `qf=title id` is the fields to be queried on, however in Lucene this isn't a parameter we use.  (Do we need it?).
1. `fl=id title poster_path overview cast` comes from the Settings
1. `wt=json` is to ensure the response is in JSON format that Quepid expects.
1. `debug=true&debug.explain.structured=true` is used to get back the query explain information.  If this isn't available, that is fine, you just don't get the information about how the query matched the docs in the UI.
1. `hl=false` disables highlighting.  We used to actually use highlighting in our snippets, so this may change.
1. `rows=10` is driven by the Settings Pane in the UI.
1. `json.wrf=angular.callbacks._8` to avoid needing to use CORS, we use JSONP, which requires this parameter to be sent to Solr, and wraps the resulting JSON response in the function `angular.callbacks._8()`.  

## Show Only Rated Documents


## Snapshot Comparison

When you have a snapshot and you want to diff it to the current try, we need to go look up by `id` the
fields for the documents that were snapshotted.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?defType=lucene&rows=15&q=id:(12697 OR 18645 OR 26965 OR 71714 OR 81899 OR 124136 OR 129848 OR 164258 OR 202337 OR 228649 OR 253150 OR 327390 OR 404021 OR 416182 OR 432613)&fl=id title poster_path overview cast&wt=json&hl=false&json.wrf=angular.callbacks._2
```

1. `defType=lucene` is to specify the lucene query parser, though not sure if that is needed.
1. `rows=15` is to control how many results come back, and is based on the number of documents that are in the snapshot.
1. `q=id:(12697 OR 18645)` is to look up the individual documents based on their `id` field.
1. `fl=id title` comes from the Settings Pane in the UI.
1. `wt=json` is to ensure the response is in JSON format that Quepid expects.
1. `hl=false` disables highlighting.  We used to actually use highlighting in our snippets, so this may be able to be removed.
1. `json.wrf=angular.callbacks._2` to avoid needing to use CORS, we use JSONP, which requires this parameter to be sent to Solr, and wraps the resulting JSON response in the function `angular.callbacks._2()`.


## View Document

From the detailed document modal view, you can view the document in Solr in a new browser window.  Notice no use of JSONP.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?indent=true&wt=xml&facet=true&facet.field=id&facet.field=title&facet.field=poster_path&facet.field=overview&facet.field=cast&facet.mincount=1&q=id:26965
````

Quepid formats this request with these parameters:

1. `indent=true` to do pretty printing of the response.
1. `wt=xml` to return in XML in the browser, though these days probably returning in JSON makes more sense.
1. `facet=true` to turn on faceting, though I am unclear why we would want to facet over all the fields, maybe to give you a sense of the attributes available?  This CAN cause major performance issue to your Solr!
1. `q=id:26965` this is the heart of the query, a look up by ID.
