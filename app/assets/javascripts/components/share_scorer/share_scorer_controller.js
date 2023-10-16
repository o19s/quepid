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
            if (share.action === 'select') {
              team    = share.selectedTeam;

              teamSvc.shareScorer(team, scorerId)
                .then(function() {
                  flash.success = 'Scorer shared with team successfully.';
                }, function() {
                  flash.error = 'Unable to share scorer with team.';
                });
            }
            else {
              team    = share.unselectedTeam;
              var scorer  = share.scorer;

              teamSvc.removeScorer(team, scorer)
                .then(function() {
                  flash.success = 'Scorer unshared from team successfully.';
                }, function() {
                  flash.error = 'Unable to unshare scorer from team.';
                });
            }                       
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
