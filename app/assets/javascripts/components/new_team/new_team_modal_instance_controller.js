'use strict';

angular.module('QuepidApp')
  .controller('NewTeamModalInstanceCtrl', [
    '$uibModalInstance',
    function ($uibModalInstance) {
      var ctrl = this;

      ctrl.team = {
        name: ''
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.team.name);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
