'use strict';

/*jshint camelcase: false */
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('AdvancedCtrl', [
    '$rootScope', '$scope',
    'flash',
    'broadcastSvc',
    'customScorerSvc',
    function (
      $rootScope, $scope,
      flash,
      broadcastSvc,
      customScorerSvc
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

      $scope.scorerFilters = { typeFilter: 'not_test' };

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
        var nonTestUserScorers          = customScorerSvc.scorers.filter(function(scorer) {
          return scorer.queryTest === false;
        });
        $scope.advanced.combinedScorers = $scope.advanced.communalScorers.concat(nonTestUserScorers);
      }

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
