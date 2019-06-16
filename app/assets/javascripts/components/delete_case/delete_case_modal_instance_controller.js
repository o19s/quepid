'use strict';

angular.module('QuepidApp')
  .controller('DeleteCaseModalInstanceCtrl', [
    '$uibModalInstance',
    'onlyCase',
    function ($uibModalInstance, onlyCase) {
      var ctrl = this;

      ctrl.onlyCase = onlyCase;

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
