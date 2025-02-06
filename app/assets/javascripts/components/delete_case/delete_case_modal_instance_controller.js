'use strict';

angular.module('QuepidApp')
  .controller('DeleteCaseModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    function ($rootScope, $uibModalInstance) {
      var ctrl = this;

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
