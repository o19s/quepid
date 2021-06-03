'use strict';

angular.module('QuepidApp')
  .controller('SearchResultsCtrl', [
    '$rootScope',
    '$scope', '$uibModal', '$log', '$window',
    'rateBulkSvc', 'userSvc', 'queriesSvc', 'queryViewSvc', 'settingsSvc',
    function (
      $rootScope, $scope, $uibModal, $log, $window,
      rateBulkSvc, userSvc, queriesSvc, queryViewSvc, settingsSvc
    ) {
      $scope.queriesSvc = queriesSvc;

      // Settings for query display
      var DisplayConfig = function() {
        this.notes = false;
        this.resultsView = {};
        this.resultsView.finder = 1;
        this.resultsView.results = 2;
        this.resultsView.diff = 3;
        this.results = this.resultsView.results;
      };

      $scope.selectedTry  = settingsSvc.applicableSettings();

      // Refresh rated-only docs if ratings have changed
      $rootScope.$on('rating-changed', function() {
        if (!queriesSvc.showOnlyRated) {
          $scope.query.refreshRatedDocs();
        }
      });

      $scope.overThreshold = function() {
        return $scope.query.lastScore && $scope.query.thresholdEnabled &&
          ($scope.query.lastScore < $scope.query.threshold);
      };

      $scope.displayed = new DisplayConfig();

      $scope.numFound = 0;
      $scope.query.getNumFound = function() {
        $scope.numFound = queriesSvc.showOnlyRated ? $scope.query.ratedDocsFound : $scope.query.numFound;
        return $scope.numFound;
      };

      $scope.query.isNotAllRated = function() {
        var score = $scope.query.currentScore;
        if (!score || score.score === null || score.allRated) {
          return false;
        }
        return true;
      };

      $scope.query.moused = false;
      $scope.query.isToggled = function() {
        return queryViewSvc.isQueryToggled($scope.query.queryId);
      };
      $scope.query.toggle = function() {
          queryViewSvc.toggleQuery($scope.query.queryId);
      };

      $scope.removeQuery = function(queryId) {
        $log.debug('Remove query!' + queryId);
        var confirm = $window.confirm('Are you absolutely sure you want to delete?');

        if (confirm) {
          queriesSvc.deleteQuery(queryId);
        }
      };

      // TODO kill this watch!
      $scope.$watch('query.diff', function() {
        if ($scope.query.diff !== null) {
          $scope.displayed.results = $scope.displayed.resultsView.diff;
        } else {
          $scope.displayed.results = $scope.displayed.resultsView.results;
        }
      });

      // TODO kill this watch!
      $scope.$watch('query.version()', function() {
        if ($scope.query.diff !== null) {
          $scope.query.diff.fetch();
        }
      });

      var src = {
        'query':  $scope.query
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateBulkSvc.setScale(src, $scope.ratings);
      });

      rateBulkSvc.setScale(src, $scope.ratings);
      rateBulkSvc.handleRatingScale($scope.ratings,
        function(ratingNo, extra) {
          var newRating = parseInt(ratingNo, 10);

          extra.query.rating = newRating;

          var ids = [];
          var docs = queriesSvc.showOnlyRated ? extra.query.ratedDocs : extra.query.docs;
          angular.forEach(docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            docs[0].rateBulk(ids, newRating);
          }
        },
        function(extra) {
          extra.query.rating = '-';

          var ids = [];
          var docs = queriesSvc.showOnlyRated ? extra.query.ratedDocs : extra.query.docs;
          angular.forEach(docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            docs[0].resetBulkRatings(ids);
          }
        },
        src
      );

      $scope.displayRating = function() {
        if (!$scope.query.rating) {
          return '-';
        }
        else {
          return $scope.query.rating;
        }
      };
    }
  ]);
