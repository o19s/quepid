# Solr Endpoints Structure

This document explains what endpoints Quepid hits on Solr.

All queries responses are of type of JSON, wrapped in JSONP function name.

## Ping Solr During Case Setup

Quepid checks that that Solr is available and responding during Case setup wizard, and if not
then Quepid attempts to privide you some workarounds.  Sometimes the workaround is to use the sample Solr
endpoint and then change it yourself in the Case Settings window ;-).

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
1. `hl=false` disables highlighting.  We used to actually use highlighting in our snippets, so this may change.
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
