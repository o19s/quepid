'use strict';

angular.module('QuepidApp')
  .controller('RemoveMemberModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    'thisTeam',
    'thisMember',
    function (
      $rootScope,
      $uibModalInstance,
      thisTeam,
      thisMember
    ) {
      var ctrl = this;

      this.thisMember = thisMember;
      this.thisTeam = thisTeam;

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

    }
  ]);
