# Solr Endpoints Structure

This document explains what endpoints Quepid hits on Solr.

Most query responses are of type of JSON, wrapped in JSONP function name.

## Ping Solr During Case Setup

Quepid checks that that Solr is available and responding during Case setup wizard, and if not
then Quepid attempts to provide you some workarounds.  You can bypass this check as well, and then
fix your Solr setup yourself in the Case Settings window ;-).

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10&json.wrf=angular.callbacks._5
```

## Basic Queries

Basic queries are sent off to Solr using the standard GET request handler.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=star%20wars&fl=id title&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10&json.wrf=angular.callbacks._2
```

Quepid adds some parameters:

1. `q=star%wars` comes from the Query Pane in the UI.
1. `fl=id title` comes from the Settings Pane in the UI.
1. `wt=json` is to ensure the response is in JSON format that Quepid expects.
1. `debug=true&debug.explain.structured=true` is used to get back the query explain information.  If this isn't available, that is fine, you just don't get the information about how the query matched the docs in the UI.
1. `echoParams=all` lets us return all the params used in constructing the query to show in the UI.  You can override this via passing in `echoParams=none`.
1. `hl=false` disables highlighting.  We used to actually use highlighting in our snippets, so this may be able to be removed.
1. `rows=10` is driven by the Settings Pane in the UI.
1. `json.wrf=angular.callbacks._2` to avoid needing to use CORS, we use JSONP, which requires this parameter to be sent to Solr, and wraps the resulting JSON response in the function `angular.callbacks._2()`.  


## Explain Missing Documents

This function sends off whatever you enter to Solr using the standard GET request handler and expects a response type of JSON, wrapped in JSONP.

```
http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=star&explainOther=title:war&fl=id title poster_path overview cast&wt=json&debug=true&debug.explain.structured=true&hl=false&rows=10&json.wrf=angular.callbacks._8
```
1. `q=star` comes from the Query that you clicked Explain Missing Documents in the UI.
1. `explainOther=title:war` comes from the query you entered on the Explain Missing Documents modal.
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
