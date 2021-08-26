'use strict';

/*jshint camelcase: false */
/*jslint latedef:false*/

// This controller manages the Scorers  screen

angular.module('QuepidApp')
  .controller('ScorersCtrl', [
    '$rootScope', '$scope',
    'flash',
    'broadcastSvc',
    'scorerSvc', 'configurationSvc',
    function (
      $rootScope, $scope,
      flash,
      broadcastSvc,
      scorerSvc, configurationSvc
    ) {
      // Attributes
      $scope.scorers                 = {};
      $scope.scorers.communalScorers = [];
      $scope.scorers.combinedScorers = [];
      $scope.scorers.userScorers     = [];
      $scope.scorers.user            = $rootScope.currentUser;

      $scope.pagination = {
        scorers: {
          currentPage:  1,
          pageSize:     10
        }
      };

      $scope.scorerFilters = { typeFilter: 'communal' };

      $scope.communalScorersOnly = configurationSvc.isCommunalScorersOnly();

      // Functions
      $scope.scorers.updateUserScorer    = updateUserScorer;

      $rootScope.$watch('currentUser', function() {
        $scope.scorers.user = $rootScope.currentUser;
      });

      $scope.loading = true;
      scorerSvc.list()
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
        $scope.scorers.communalScorers  = scorerSvc.communalScorers;
        $scope.scorers.userScorers     = scorerSvc.scorers;
        $scope.scorers.combinedScorers = $scope.scorers.communalScorers.concat($scope.scorers.userScorers);
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
