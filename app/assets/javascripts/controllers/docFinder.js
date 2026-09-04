'use strict';

angular.module('QuepidApp')
  .controller('DocFinderCtrl', [
    '$scope',
    'queriesSvc', 'settingsSvc',
    'solrExplainExtractorSvc', 'esExplainExtractorSvc',
    'rateBulkSvc',
    function (
      $scope,
      queriesSvc, settingsSvc,
      solrExplainExtractorSvc, esExplainExtractorSvc,
      rateBulkSvc
    ) {
      $scope.defaultList = false;
      $scope.docFinder = {
        docs:        [],
        lastQuery:   '',
        queryText:   '',
        queryParams: '',
        parseError:  false,
      };

      var currSettings = settingsSvc.editableSettings();
      $scope.settings = currSettings;

      // The try's saved queryParams still has the '#$query##' placeholder in it - swap in the
      // actual query being tested (the same substitution fetch_service.rb does at search time)
      // so the editor shows e.g. 'q=news&magicBoost=15' instead of 'q=#$query##&magicBoost=15'.
      function resolveQueryPlaceholder(queryParams) {
        return queryParams ? queryParams.replace(/#\$query##/g, $scope.query.queryText) : queryParams;
      }

      $scope.docFinder.queryParams = resolveQueryPlaceholder(currSettings.selectedTry.queryParams);

      // Solr/ES/OpenSearch: the query box is now the same kind of full query-params editor as
      // the Query Sandbox (pre-filled from the try's current query), rather than a Lucene
      // keyword fragment merged into the configured query via explainOther(). We resolve the
      // edited text into args via settingsSvc.previewArgs() (server-side, non-persisting —
      // reuses Try#args/SolrArgParser/EsArgParser so curator vars etc. behave identically to
      // the real Sandbox), then run a real search and explain it the same way normal results
      // are explained (queriesSvc.normalizeDocExplains), instead of the old solr/es/os-only
      // explainOther dispatch below (which has no case for searchapi/vectara/algolia at all).
      var ENGINES_WITH_QUERY_PARAMS_EDITOR = [ 'solr', 'es', 'os' ];

      function findDocsByPreviewingQueryParams() {
        var settings  = settingsSvc.editableSettings();
        var query     = $scope.query;
        var fieldSpec = settings.createFieldSpec();

        $scope.docFinder.searching = true;

        return settingsSvc.previewArgs(settings.selectedTry.tryNo, $scope.docFinder.queryParams).then(function(resolvedArgs) {
          $scope.docFinder.searching = false;
          $scope.docFinder.lastQuery = $scope.docFinder.queryParams;

          if (resolvedArgs === null) {
            $scope.docFinder.numFound   = 0;
            $scope.docFinder.parseError = true;
            return;
          }

          $scope.docFinder.parseError = false;

          var tempSettings = angular.extend({}, settings, {
            selectedTry: angular.extend({}, settings.selectedTry, {
              args:        resolvedArgs,
              queryParams: $scope.docFinder.queryParams
            })
          });

          $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(tempSettings, query);

          return $scope.docFinder.searcher.search().then(function() {
            $scope.docFinder.numFound = $scope.docFinder.searcher.numFound;
            $scope.docFinder.docs     = queriesSvc.normalizeDocExplains(query, $scope.docFinder.searcher, fieldSpec);
          });
        });
      }

      $scope.findDocs = function() {
        $scope.defaultList     = false;
        $scope.docFinder.docs  = [];

        var settings = settingsSvc.editableSettings();

        if (ENGINES_WITH_QUERY_PARAMS_EDITOR.indexOf(settings.searchEngine) !== -1) {
          return findDocsByPreviewingQueryParams();
        }

        var query         = $scope.query;
        var ratingsStore  = $scope.query.ratingsStore;
        var fieldSpec     = settings.createFieldSpec();

        $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(settings, query);

        $scope.docFinder.searcher.explainOther($scope.docFinder.queryText, fieldSpec)
          .then(function() {
            $scope.docFinder.numFound   = $scope.docFinder.searcher.numFound;
            $scope.docFinder.lastQuery  = $scope.docFinder.queryText;

            var normalizedDocs;
            if ( $scope.docFinder.searcher.type === 'solr' ) {
              normalizedDocs = solrExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec, $scope.docFinder.searcher.othersExplained);
            } else if ( $scope.docFinder.searcher.type === 'es' || $scope.docFinder.searcher.type === 'os') {
              normalizedDocs = esExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec);
            }

            angular.forEach(normalizedDocs, function(doc) {
              var rateableDoc = ratingsStore.createRateableDoc(doc);
              $scope.docFinder.docs.push(rateableDoc);
            });
          });
      };

      $scope.paginate = function() {
        if($scope.defaultList) {
          $scope.paginateRatedQuery();
        } else {
          $scope.paginateCustomQuery();
        }
      };

      $scope.paginateCustomQuery = function() {
        if ( $scope.docFinder.searcher === null ) {
          return;
        }

        var settings = settingsSvc.editableSettings();

        if (ENGINES_WITH_QUERY_PARAMS_EDITOR.indexOf(settings.searchEngine) !== -1) {
          $scope.docFinder.searcher = $scope.docFinder.searcher.pager();
          $scope.docFinder.paging = true;

          if ( $scope.docFinder.searcher === null ) {
            $scope.docFinder.paging = false;
            return;
          }

          var previewFieldSpec = settings.createFieldSpec();

          $scope.docFinder.searcher.search().then(function() {
            $scope.docFinder.numFound = $scope.docFinder.searcher.numFound;
            var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, previewFieldSpec);
            $scope.docFinder.docs = $scope.docFinder.docs.concat(normed);
            $scope.docFinder.paging = false;
          });

          return;
        }

        $scope.docFinder.searcher = $scope.docFinder.searcher.pager();
        $scope.docFinder.paging = true;

        if ( $scope.docFinder.searcher === null ) {
          $scope.docFinder.paging = false;
          return;
        }

        var fieldSpec     = settings.createFieldSpec();
        var ratingsStore  = $scope.query.ratingsStore;

        $scope.docFinder.searcher.explainOther($scope.docFinder.queryText, fieldSpec)
          .then(function() {
            $scope.docFinder.numFound   = $scope.docFinder.searcher.numFound;
            $scope.docFinder.lastQuery  = $scope.docFinder.queryText;

            var normalizedDocs;
            if ( $scope.docFinder.searcher.type === 'solr' ) {
              normalizedDocs = solrExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec, $scope.docFinder.searcher.othersExplained);
            } else if ( $scope.docFinder.searcher.type === 'es' || $scope.docFinder.searcher.type === 'os' ) {
              normalizedDocs = esExplainExtractorSvc.docsWithExplainOther($scope.docFinder.searcher.docs, fieldSpec);
            }

            angular.forEach(normalizedDocs, function(doc) {
              var rateableDoc = ratingsStore.createRateableDoc(doc);
              $scope.docFinder.docs.push(rateableDoc);
            });

            $scope.docFinder.paging = false;
          });
      };

      $scope.paginateRatedQuery = function() {
        $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(currSettings, $scope.query, { filterToRated: true });
        $scope.docFinder.paging = true;

        var settings      = settingsSvc.editableSettings();
        var fieldSpec     = settings.createFieldSpec();


        if ($scope.docFinder.searcher.type === 'es' || $scope.docFinder.searcher.type === 'os') {
          var filter = {
            'query': $scope.query.filterToRatings(currSettings, $scope.docFinder.docs.length)
          };
          // explainOther() doesn't reliably route through Quepid's proxy (unlike search()),
          // so it 400s/CORS-fails whenever the endpoint requires proxying - reuse the same
          // "swap in this query, then just search()" technique the templated-call branch
          // below already relies on instead.
          $scope.docFinder.searcher.queryDsl = filter;
          $scope.docFinder.searcher.search()
            .then(function() {
              var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);
              $scope.docFinder.docs = $scope.docFinder.docs.concat(normed);
            });
        } else if ($scope.docFinder.searcher.type === 'solr') {
          $scope.docFinder.searcher.explainOther(
            $scope.query.filterToRatings(currSettings, $scope.docFinder.docs.length), fieldSpec, 'lucene')
            .then(function() {
              var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);
              $scope.docFinder.docs = $scope.docFinder.docs.concat(normed);
          });
        }
      };


      var src = {
        'query':  $scope.query
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateBulkSvc.setScale(src, $scope.ratings);
      });

      rateBulkSvc.setScale(src, $scope.ratings);
      rateBulkSvc.handleRatingScale($scope.ratings,
        function(ratingNo) {
          var newRating = parseInt(ratingNo, 10);

          var ids = [];
          angular.forEach($scope.docFinder.docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            $scope.docFinder.docs[0].rateBulk(ids, newRating);
          }
        },
        function() {
          var ids = [];
          angular.forEach($scope.docFinder.docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            $scope.docFinder.docs[0].resetBulkRatings(ids);
          }
        },
        src
      );

      $scope.resetToAllRatedDocs = function(){
        $scope.docFinder.queryText = '';
        $scope.docFinder.queryParams = resolveQueryPlaceholder(currSettings.selectedTry.queryParams);
        $scope.docFinder.parseError = false;
        $scope.docFinder.docs = [];
        $scope.initializeToRatedDocs();

      };

      $scope.initializeToRatedDocs = function() {
        // Initialize to rated docs
        var fieldSpec = currSettings.createFieldSpec();
        var ratedIDs = $scope.query.ratings ? Object.keys($scope.query.ratings) : [];

        // The filter here is for empty ID's that seem to sneak in, a bug somewhere else?
        ratedIDs = ratedIDs.filter( (r) => { return r.length > 0; });

        // Don't query if there are no ratings, the "no results" message is weird.
        if (ratedIDs.length === 0) {
          return;
        }

        $scope.docFinder.numFound = ratedIDs.length;
        $scope.docFinder.totalRatings = ratedIDs.length;

        $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(currSettings, $scope.query);

        if ($scope.docFinder.searcher.type === 'es' || $scope.docFinder.searcher.type === 'os') {
          var filter = {
            'query': $scope.query.filterToRatings(currSettings, $scope.docFinder.docs.length)
          };
          if($scope.docFinder.searcher.isTemplateCall($scope.docFinder.searcher.args)){
            // Do a normal search if it's a templated call as we can't get the explain.
            delete $scope.docFinder.searcher.args.id;
            delete $scope.docFinder.searcher.args.params;
            $scope.docFinder.searcher.queryDsl = filter; // is this terrible?
            $scope.docFinder.searcher.search(filter).then(function(){
              var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);
              $scope.docFinder.docs = normed;

              $scope.defaultList = true;
            });
          }
          else {
            // explainOther() doesn't reliably route through Quepid's proxy (unlike
            // search()), so it 400s/CORS-fails whenever the endpoint requires proxying -
            // reuse the same "swap in this query, then just search()" technique the
            // templated-call branch above already relies on instead.
            $scope.docFinder.searcher.queryDsl = filter;
            $scope.docFinder.searcher.search()
              .then(function() {
                let normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);
                $scope.docFinder.docs = normed;

                $scope.defaultList = true;
            });
          }

        } else if ($scope.docFinder.searcher.type === 'solr') {
          // explainOther() reuses the try's own args.start as the offset for its second
          // (metadata-fetch) query - fine when listing a page of real results, but wrong
          // here: we're looking up a specific handful of already-rated doc IDs, so a try
          // saved mid-page (e.g. start=800) makes it look past all of them and find nothing,
          // even though the ratings themselves were found just fine.
          delete $scope.docFinder.searcher.args.start;

          $scope.docFinder.searcher.explainOther(
            $scope.query.filterToRatings(currSettings, $scope.docFinder.docs.length), fieldSpec, 'lucene')
            .then(function() {
              var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);
              $scope.docFinder.docs = normed;

              $scope.defaultList = true;
          });
        }
      };


      $scope.initializeToRatedDocs();
    }
  ]);
