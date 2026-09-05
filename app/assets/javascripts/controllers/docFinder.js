'use strict';

angular.module('QuepidApp')
  .controller('DocFinderCtrl', [
    '$scope',
    'queriesSvc', 'settingsSvc',
    'rateBulkSvc',
    function (
      $scope,
      queriesSvc, settingsSvc,
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

      // Finding and rating missing documents is only supported for engines where we can
      // resolve an edited query-params string into real args server-side (settingsSvc.
      // previewArgs(), reusing Try#args/SolrArgParser/EsArgParser so curator vars etc. behave
      // identically to the real Query Sandbox) and then run a real search against them. There's
      // no generic way to do this for vectara/algolia/static (no shared query-params shape to
      // preview), so the modal shows an unsupported message for those instead - see
      // usesQueryParamsEditor below and targetedSearchModal.html.
      var SUPPORTED_SEARCH_ENGINES = [ 'solr', 'es', 'os', 'searchapi' ];

      $scope.usesQueryParamsEditor = SUPPORTED_SEARCH_ENGINES.indexOf(currSettings.searchEngine) !== -1;

      function findDocsByPreviewingQueryParams() {
        var settings  = settingsSvc.editableSettings();
        var query     = $scope.query;
        var fieldSpec = settings.createFieldSpec();

        $scope.docFinder.searching = true;
        $scope.docFinder.searchApiPageArgs = null;

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

      // Only reachable when usesQueryParamsEditor is true - the search form is hidden
      // otherwise (see targetedSearchModal.html).
      $scope.findDocs = function() {
        $scope.defaultList     = false;
        $scope.docFinder.docs  = [];

        return findDocsByPreviewingQueryParams();
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

        $scope.docFinder.paging = true;

        if (settings.searchEngine === 'searchapi') {
          // searchApiSearcherFactory's pager() always returns null - Vespa/generic search
          // APIs have no built-in offset concept, so widen the request ourselves the same
          // way queriesSvc.js's paginate() does: bump hits/offset on the args the last
          // search actually used.
          var hitsParam   = settings.selectedTry.mapperBasedSearchEnginePaginationHitsParam;
          var offsetParam = settings.selectedTry.mapperBasedSearchEnginePaginationOffsetParam;

          if (!hitsParam || !offsetParam) {
            $scope.docFinder.paging = false;
            return;
          }

          $scope.docFinder.searchApiPageArgs = queriesSvc.nextSearchApiPageArgs(
            $scope.docFinder.searchApiPageArgs || $scope.docFinder.searcher.args,
            settings.numberOfRows, hitsParam, offsetParam);

          var tempSettings = angular.extend({}, settings, {
            selectedTry: angular.extend({}, settings.selectedTry, { args: $scope.docFinder.searchApiPageArgs })
          });

          $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(tempSettings, $scope.query);
        } else {
          $scope.docFinder.searcher = $scope.docFinder.searcher.pager();

          if ( $scope.docFinder.searcher === null ) {
            $scope.docFinder.paging = false;
            return;
          }
        }

        var previewFieldSpec = settings.createFieldSpec();

        $scope.docFinder.searcher.search().then(function() {
          $scope.docFinder.numFound = $scope.docFinder.searcher.numFound;
          var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, previewFieldSpec);
          $scope.docFinder.docs = $scope.docFinder.docs.concat(normed);
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
        $scope.docFinder.searchApiPageArgs = null;
        $scope.docFinder.docs = [];
        $scope.initializeToRatedDocs();

      };

      $scope.initializeToRatedDocs = function() {
        // vectara/algolia/static aren't supported at all in this modal (see
        // usesQueryParamsEditor above) - nothing to look up.
        if (!$scope.usesQueryParamsEditor) {
          return;
        }

        // Initialize to rated docs
        var fieldSpec = currSettings.createFieldSpec();
        var ratedIDs = $scope.query.ratings ? Object.keys($scope.query.ratings) : [];

        // The filter here is for empty ID's that seem to sneak in, a bug somewhere else?
        ratedIDs = ratedIDs.filter( (r) => { return r.length > 0; });

        // Don't query if there are no ratings, the "no results" message is weird.
        if (ratedIDs.length === 0) {
          return;
        }

        $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(currSettings, $scope.query);

        // filterToRatings() (queriesSvc.js) has no generic implementation for searchapi -
        // there's no one query syntax to build a "just these rated doc IDs" filter across
        // arbitrary search APIs. A searchapi/mapper-based engine can opt in anyway by defining
        // its own ratedDocsQueryParamsMapper (see the searchapi branch below and
        // db/mapper_based_search_engines/vespa.js for an example); a plain searchapi engine
        // without one leaves numFound unset rather than show "There are N ratings" with
        // nothing to show for it (see the start-offset fix above for why that's worth avoiding).
        var supportsSearchApiRatedLookup = $scope.docFinder.searcher.type === 'searchapi' &&
          currSettings.selectedTry.mapperBasedSearchEngineSupportsRatedDocsLookup;

        if ([ 'es', 'os', 'solr' ].indexOf($scope.docFinder.searcher.type) === -1 && !supportsSearchApiRatedLookup) {
          return;
        }

        $scope.docFinder.numFound = ratedIDs.length;
        $scope.docFinder.totalRatings = ratedIDs.length;

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
        } else if (supportsSearchApiRatedLookup) {
          var ratedQueryParams = queriesSvc.buildSearchApiRatedDocsQueryParams(currSettings.selectedTry.mapperCode, ratedIDs);

          if (!ratedQueryParams) {
            return;
          }

          // Same non-persisting preview-then-search technique as findDocsByPreviewingQueryParams()
          // above, just with a mapper-built ID-filter query instead of the user's edited text.
          settingsSvc.previewArgs(currSettings.selectedTry.tryNo, ratedQueryParams).then(function(resolvedArgs) {
            if (resolvedArgs === null) {
              return;
            }

            var tempSettings = angular.extend({}, currSettings, {
              selectedTry: angular.extend({}, currSettings.selectedTry, { args: resolvedArgs })
            });

            $scope.docFinder.searcher = queriesSvc.createSearcherFromSettings(tempSettings, $scope.query);

            return $scope.docFinder.searcher.search().then(function() {
              var normed = queriesSvc.normalizeDocExplains($scope.query, $scope.docFinder.searcher, fieldSpec);
              $scope.docFinder.docs = normed;

              $scope.defaultList = true;
            });
          });
        }
      };


      $scope.initializeToRatedDocs();
    }
  ]);
