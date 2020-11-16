'use strict';

/*jshint camelcase: false */
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('AdvancedCtrl', [
    '$rootScope', '$scope',
    'flash',
    'broadcastSvc',
    'customScorerSvc', 'configurationSvc',
    function (
      $rootScope, $scope,
      flash,
      broadcastSvc,
      customScorerSvc, configurationSvc
    ) {
      // Attributes
      $scope.advanced                 = {};
      $scope.advanced.communalScorers = [];
      $scope.advanced.combinedScorers = [];
      $scope.advanced.userScorers     = [];
      $scope.advanced.user            = $rootScope.currentUser;

      $scope.pagination = {
        scorers: {
          currentPage:  1,
          pageSize:     10
        }
      };

      $scope.scorerFilters = { typeFilter: 'communal' };

      $scope.communalScorersOnly = configurationSvc.isCommunalScorersOnly();

      // Functions
      $scope.advanced.updateUserScorer    = updateUserScorer;

      $rootScope.$watch('currentUser', function() {
        $scope.advanced.user = $rootScope.currentUser;
      });

      $scope.loading = true;
      customScorerSvc.list()
        .then(function() {
          broadcastSvc.send('updatedScorersList');
          $scope.loading = false;
        }, function(response) {
          flash.error = response.data.message;
          $scope.loading = false;
        });

      var events = [
        'updatedScorersList',
      ];
      angular.forEach(events, function (eventName) {
        $scope.$on(eventName, function() {
          $scope.advanced._internalScorersList = customScorerSvc.scorers;
          getLists();
        });
      });

      function getLists() {
        $scope.advanced.communalScorers  = customScorerSvc.communalScorers;
        $scope.advanced.userScorers     = customScorerSvc.scorers;
        //var nonTestUserScorers          = customScorerSvc.scorers.filter(function(scorer) {
          //return scorer.queryTest === false;
        //});
        //array1.filter(val => !array2.includes(val));

        //$scope.advanced.combinedScorers = $scope.advanced.communalScorers.concat(customScorerSvc.scorers);
        angular.forEach($scope.advanced.userScorers, function(scorer) {
          if (!contains($scope.advanced.combinedScorers, scorer)) {
            $scope.advanced.combinedScorers.push(scorer);
          }
        });
        angular.forEach($scope.advanced.communalScorers, function(scorer) {
          if (!contains($scope.advanced.combinedScorers, scorer)) {
            $scope.advanced.combinedScorers.push(scorer);
          }
        });
      }

      var contains = function(list, scorer) {
        return list.filter(function(item) { return item.scorerId === scorer.scorerId; }).length > 0;
      };

      function updateUserScorer(scorerId) {
        $rootScope.currentUser.updateUserScorer(scorerId)
          .then(function() {
            flash.success = 'Your default scorer has been updated successfully';
          }, function(response) {
            flash.error = response.data.message;
          });
      }
    }
  ]);
