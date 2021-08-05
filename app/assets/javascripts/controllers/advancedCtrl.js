'use strict';

/*jshint camelcase: false */
/*jslint latedef:false*/

// This controller manages the Scorer Options screen

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
          getLists();
          $scope.loading = false;
        }, function(response) {
          flash.error = response.data.message;
          $scope.loading = false;
        });


      $scope.$on('updatedScorersList', function() {
        getLists();
      });

      function getLists() {
        $scope.advanced.communalScorers  = customScorerSvc.communalScorers;
        $scope.advanced.userScorers     = customScorerSvc.scorers;
        $scope.advanced.combinedScorers = $scope.advanced.communalScorers.concat($scope.advanced.userScorers);
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
