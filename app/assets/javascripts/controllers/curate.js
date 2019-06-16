'use strict';

angular.module('QuepidApp')
  .controller('CurateCtrl', [
    '$scope',
    '$route',
    '$log',
    'queriesSvc', 'caseTryNavSvc', 'settingsSvc',
    'paneSvc',
    function (
      $scope,
      $route,
      $log,
      queriesSvc, caseTryNavSvc, settingsSvc,
      paneSvc
    ) {
      $scope.curate   = {
        searchString: caseTryNavSvc.getCurateSearch(),
        tryName:      '',
      };
      $scope.query    = null;
      var submitted   = [];
      var numSearches = 1;

      // Sets up the panes stuff only when needed
      paneSvc.initPanes();

      if ( angular.isDefined(settingsSvc.applicableSettings()) ) {
        $scope.curate.tryName = settingsSvc.applicableSettings().name || '';
      }

      $scope.curate.search = function() {
        // TODO set query to existing query
        $scope.query = null;
        angular.forEach(queriesSvc.queries, function(query) {
          if ($scope.query === null && $scope.curate.searchString === query.queryText) {
            query.docs.length = 0;
            $scope.query = query;
          }
        });
        if ($scope.query === null) {
          $scope.query = queriesSvc.createQuery($scope.curate.searchString);
        }
        submitted.push($scope.curate.searchString);
        $scope.query.search()
          .then(function() {
            numSearches++;
            angular.forEach($scope.query.docs, function(doc) {
              var origRate = doc.rate;
              doc.rate = function(rating) {
                if (!$scope.query.persisted()) {
                  queriesSvc.persistQuery($scope.query)
                  .then(function() {
                    origRate.apply(doc, [rating]);
                  });
                }
                else {
                  origRate.apply(doc, [rating]);
                }
              };
            });
          }, function(response) {
            $log.debug('Failed to search for query: ', response);
          });
      };

      $scope.curate.suggestQueries = function() {
        var suggest = angular.copy(submitted);
        angular.forEach(queriesSvc.queryArray(), function(query) {
          suggest.push(query.queryText);
        });
        return suggest;
      };

      $scope.curate.numSearches = function() {
        return numSearches;
      };

      $scope.curate.newSearch = function() {
        caseTryNavSvc.navigateTo(
          { curateSearch: $scope.curate.searchString },
          500 /* navdelay */
        );
        $route.reload();
      };

      $scope.curate.navigateToTry = function() {
        caseTryNavSvc.navigateTo({curate: false});
      };

      queriesSvc.querySearchReady()
      .then(function() {
        $scope.curate.search();
      });
    }
  ]);
