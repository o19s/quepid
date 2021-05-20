'use strict';

angular.module('QuepidApp')
  .controller('RemoveScorerModalInstanceCtrl', [
    '$uibModalInstance','thisTeam','thisScorer',
    function ($uibModalInstance, thisTeam, thisScorer) {
      var ctrl = this;

      ctrl.canUpdateTeam = false;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.canCreateTeam = $rootScope.currentUser.permissions.team.update;
        }
      });

      this.thisScorer = thisScorer;
      this.thisTeam = thisTeam;

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

    }
  ]);
