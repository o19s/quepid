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
      $scope.advanced.defaultScorers  = [];
      $scope.advanced.combinedScorers = [];
      $scope.advanced.quepidScorers   = [];
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
      $scope.advanced.updateDefaultScorer = updateDefaultScorer;

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
        $scope.advanced.defaultScorers  = customScorerSvc.defaultScorers;
        $scope.advanced.userScorers     = customScorerSvc.scorers;
        $scope.advanced.quepidScorers   = customScorerSvc.quepidScorers;
        $scope.advanced.combinedScorers = $scope.advanced.userScorers.concat($scope.advanced.quepidScorers);
      }

      function updateUserScorer(scorerId) {
        $rootScope.currentUser.updateUserScorer(scorerId)
          .then(function() {
            flash.success = 'Your default scorer has been updated successfully';
          }, function(response) {
            flash.error = response.data.message;
          });
      }

      function updateDefaultScorer(scorerId) {
        $rootScope.currentUser.updateDefaultScorer(scorerId)
          .then(function() {
            flash.success = 'Your Quepid scorer has been updated successfully';
          }, function(response) {
            flash.error = response.data.message;
          });
      }
    }
  ]);
