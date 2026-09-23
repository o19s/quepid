'use strict';
angular.module('QuepidApp')
  .controller('SearchResultsCtrl', [
    '$rootScope', '$scope', '$element', '$log',
    'clipboardSvc', 'rateScaleSvc', 'queriesSvc', 'queryViewSvc', 'settingsSvc',
    function (
      $rootScope, $scope, $element, $log,
      clipboardSvc, rateScaleSvc, queriesSvc, queryViewSvc, settingsSvc
    ) {
      $scope.queriesSvc = queriesSvc;

      $scope.copyQueryText = function() {
        clipboardSvc.copy($scope.query.queryText).catch(angular.noop);
      };

      // Settings for query display
      var DisplayConfig = function() {
        this.notes = false;
        this.resultsView = {};
        this.resultsView.finder = 1;
        this.resultsView.results = 2;
        this.resultsView.diffs = 3;
        this.results = this.resultsView.results;
      };

      $scope.selectedTry  = settingsSvc.applicableSettings();

      // Refresh rated-only docs if ratings have changed
      var ratingChangedHandler = function(event, legacyQueryId) {
        var queryId = window.quepidSearch.queryState.ratingChangedQueryId(event, legacyQueryId);
        $scope.$evalAsync(function() {
          if ($scope.query.queryId !== queryId) {
            return;
          }

          if (queriesSvc.showOnlyRated) {
            $scope.query.refreshRatedDocs();
          } else {
            queriesSvc.updateScores();
          }
        });
      };
      var legacyRatingChangedListener;
      if (window.quepidStore && window.quepidStore.scoring) {
        window.quepidStore.scoring.addEventListener('rating-changed', ratingChangedHandler);
      } else {
        legacyRatingChangedListener = $rootScope.$on('rating-changed', function(event, queryId) {
          ratingChangedHandler(event, queryId);
        });
      }


      $scope.displayed = new DisplayConfig();

      var syncDisplayState = function() {
        if (window.quepidStore && window.quepidStore.documents) {
          window.quepidStore.documents.updateQueryState($scope.query.queryId, {
            expanded: $scope.query.isToggled(),
            resultsView: $scope.displayed.results,
            showOnlyRated: queriesSvc.showOnlyRated
          });
        }
      };

      $scope.numFound = 0;
      $scope.query.getNumFound = function() {
        $scope.numFound = window.quepidSearch.queryState.queryResultCount(
          $scope.query,
          queriesSvc.showOnlyRated
        );
        return $scope.numFound;
      };

      //$scope.query.moused = false;
      $scope.query.isToggled = function() {
        return queryViewSvc.isQueryToggled($scope.query.queryId);
      };
      $scope.query.toggle = function() {
          queryViewSvc.toggleQuery($scope.query.queryId);
          syncDisplayState();
      };
      syncDisplayState();

      // The query-row Stimulus controller owns the header click. Keep the
      // expanded content and query-view state in Angular until that island is
      // migrated, and bridge only the intent here.
      $element.on('query-row:toggle', function(event) {
        var originalEvent = event.originalEvent;
        if (!originalEvent || originalEvent.detail.queryId !== $scope.query.queryId) {
          return;
        }
        if (!$scope.isSortingEnabled()) {
          $scope.$apply(function() {
            $scope.query.toggle();
          });
        }
      });

      var queryDeleteCompletedHandler = function(event) {
        var originalEvent = event.originalEvent;
        if (!originalEvent || originalEvent.detail.queryId !== $scope.query.queryId) {
          return;
        }

        queriesSvc.removeQueryFromState(originalEvent.detail.queryId);
        $log.info('rescoring queries after removing query');
        queriesSvc.updateScores();
      };
      $element.on('query-delete:completed', queryDeleteCompletedHandler);

      // Watch for diff changes - unified logic for all diff scenarios
      $scope.$watch('query.diffs', function() {
        if ($scope.query.diffs !== null) {
          $scope.displayed.results = $scope.displayed.resultsView.diffs;
        } else {
          $scope.displayed.results = $scope.displayed.resultsView.results;
        }
        syncDisplayState();
      });

      // Watch for query version changes - unified logic for all diff scenarios
      $scope.$watch('query.version()', function() {
        if ($scope.query.diffs !== null) {
          $scope.query.diffs.fetch();
        }
      });

      var src = {
        'query':  $scope.query
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateScaleSvc.setScale(src, $scope.ratings);
      });

      rateScaleSvc.setScale(src, $scope.ratings);

      // Content and open/close state now live in the rating-popover Stimulus
      // controller (data-controller="rating-popover" in searchResults.html);
      // it dispatches these events on its own element, which bubble up to
      // this directive's root element. Stop propagation so a per-doc
      // search-result row's own rating-popover event never reaches here too
      // (each search-result row registers its own listener closer to the
      // source and stops the event there).
      $element.on('rating-popover:rate', function(event) {
        event.stopPropagation();
        var detail = event.originalEvent.detail || {};
        if (detail.source === 'single-result') {
          return;
        }
        var newRating = parseInt(detail.rating, 10);

        src.query.rating = newRating;

        var ids = [];
        var docs = queriesSvc.showOnlyRated ? src.query.ratedDocs : src.query.docs;
        angular.forEach(docs, function(doc) {
          ids.push(doc.id);
        });

        if ( ids.length > 0 ) {
          docs[0].rateBulk(ids, newRating);
        }
        src.query.touchModifiedAt();
        $scope.$apply();
      });

      $element.on('rating-popover:reset', function(event) {
        event.stopPropagation();
        if ((event.originalEvent.detail || {}).source === 'single-result') {
          return;
        }
        src.query.rating = '--';

        var ids = [];
        var docs = queriesSvc.showOnlyRated ? src.query.ratedDocs : src.query.docs;
        angular.forEach(docs, function(doc) {
          ids.push(doc.id);
        });

        if ( ids.length > 0 ) {
          docs[0].resetBulkRatings(ids);
        }
        src.query.touchModifiedAt();
        $scope.$apply();
      });

      $scope.$on('$destroy', function() {
        $element.off('query-delete:completed', queryDeleteCompletedHandler);
        $element.off('rating-popover:rate rating-popover:reset');
        if (window.quepidStore && window.quepidStore.scoring) {
          window.quepidStore.scoring.removeEventListener('rating-changed', ratingChangedHandler);
        }
        if (legacyRatingChangedListener) {
          legacyRatingChangedListener();
        }
      });

      $scope.displayRating = function() {
        if (!$scope.query.rating) {
          return '--';
        }
        else {
          return $scope.query.rating;
        }
      };
      
      $scope.querqyRuleTriggered = function () {
        return window.quepidSearch.queryState.querqyRuleTriggered(
          $scope.query.searcher && $scope.query.searcher.parsedQueryDetails
        );
      };
    }
  ]);
