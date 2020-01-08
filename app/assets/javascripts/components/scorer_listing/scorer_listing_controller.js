'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerListingCtrl', [
    '$window',
    '$scope',
    'flash',
    'customScorerSvc',
    'teamSvc',
    function (
      $window,
      $scope,
      flash,
      customScorerSvc,
      teamSvc
    ) {
      var ctrl = this;
      console.log('About to set the team');
      ctrl.scorer = $scope.scorer;
      ctrl.team  = $scope.team;

      // Functions
      ctrl.deleteScorer = deleteScorer;
      ctrl.removeScorer = removeScorer;

      function deleteScorer() {
        var deleteScorer = $window.confirm('Are you absolutely sure you want to delete?');

        if (deleteScorer) {
          customScorerSvc.delete(ctrl.scorer)
            .then(function() {
              flash.success = 'Scorer deleted successfully';
            },
            function(response) {
              flash.error = response.data.error;
            });
        }
      }

      function removeScorer() {
        var removeScorer = $window.confirm('Are you absolutely sure you want to remove this scorer from this team?');

        if (removeScorer) {
          teamSvc.removeScorer(ctrl.team, ctrl.scorer)
            .then(function() {
              flash.success = 'Scorer removed from team';
            }, function(response) {
              flash.error = response.data.error;
            });
        }
      }
    }
  ]);
