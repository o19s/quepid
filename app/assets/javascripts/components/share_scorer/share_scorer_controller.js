'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ShareScorerCtrl', [
    '$uibModal',
    '$log',
    '$scope',
    'flash',
    'teamSvc',
    function (
      $uibModal,
      $log,
      $scope,
      flash,
      teamSvc
    ) {
      var ctrl = this;
      ctrl.scorer = $scope.scorer;

      // Functions
      ctrl.shareScorer = shareScorer;

      function shareScorer() {
        var modalInstance = $uibModal.open({
          templateUrl:  'share_scorer/_modal.html',
          controller:   'ShareScorerModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            scorer: function() {
              return ctrl.scorer;
            }
          }
        });

        modalInstance.result.then(
          function(share) {
            var scorerId  = share.scorer.scorerId;
            var team      = share.selectedTeam;

            teamSvc.shareScorer(team, scorerId)
              .then(function() {
                flash.success = 'Scorer shared with team successfully';
              }, function(response) {
                flash.error = response.data.message;
              });
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
