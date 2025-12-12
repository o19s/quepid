'use strict';
angular.module('QuepidApp')
  .controller('SearchResultsCtrl', [
    '$rootScope',
    '$scope', '$log', '$window',
    'rateBulkSvc', 'queriesSvc', 'queryViewSvc', 'settingsSvc',
    function (
      $rootScope, $scope, $log, $window,
      rateBulkSvc, queriesSvc, queryViewSvc, settingsSvc
    ) {
      $scope.queriesSvc = queriesSvc;

      // Settings for query display
      var DisplayConfig = function() {
        this.notes = false;
        this.resultsView = {};
        this.resultsView.finder = 1;
        this.resultsView.results = 2;
        this.resultsView.diff = 3;
        this.resultsView.multiDiff = 4;
        this.results = this.resultsView.results;
      };

      $scope.selectedTry  = settingsSvc.applicableSettings();

      // Refresh rated-only docs if ratings have changed
      $rootScope.$on('rating-changed', function(e, queryId) {
        if (!queriesSvc.showOnlyRated && $scope.query.queryId === queryId) {
          queriesSvc.updateScores();          
        }
      });


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

      //$scope.query.moused = false;
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
          queriesSvc.deleteQuery(queryId).then(function() {
            $log.info('rescoring queries after removing query');
            queriesSvc.updateScores();
          });
          
        }
      };

      // TODO kill this watch!
      // Watch for diff changes - legacy support, but now handled by multiDiff
      $scope.$watch('query.diff', function() {
        // Single diffs are now handled through the multiDiff path
        // This watch is kept for compatibility but doesn't change the view
      });

      // Watch for multi-diff changes - unified logic for all diff scenarios
      $scope.$watch('query.multiDiff', function() {
        if ($scope.query.multiDiff !== null) {
          $scope.displayed.results = $scope.displayed.resultsView.multiDiff;
        } else {
          $scope.displayed.results = $scope.displayed.resultsView.results;
        }
      });

      // Watch for query version changes - unified logic for all diff scenarios
      $scope.$watch('query.version()', function() {
        if ($scope.query.multiDiff !== null) {
          $scope.query.multiDiff.fetch();
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
          extra.query.touchModifiedAt();
        },
        function(extra) {
          extra.query.rating = '--';

          var ids = [];
          var docs = queriesSvc.showOnlyRated ? extra.query.ratedDocs : extra.query.docs;
          angular.forEach(docs, function(doc) {
            ids.push(doc.id);
          });

          if ( ids.length > 0 ) {
            docs[0].resetBulkRatings(ids);
          }
          extra.query.touchModifiedAt();
        },
        src
      );

      $scope.displayRating = function() {
        if (!$scope.query.rating) {
          return '--';
        }
        else {
          return $scope.query.rating;
        }
      };
      
      $scope.querqyRuleTriggered = function () {
        let triggered = false;
        
        if ($scope.query.searcher && $scope.query.searcher.parsedQueryDetails) {
          let parsedQueryDetails = $scope.query.searcher.parsedQueryDetails;
          
          if (parsedQueryDetails.querqy?.rewrite !== undefined) { // jshint ignore:line
            triggered = true;
          }
          else if ('querqy.infoLog' in parsedQueryDetails){
            triggered = true;
          }
        }
          
        return triggered;
      };
    }
  ]);
