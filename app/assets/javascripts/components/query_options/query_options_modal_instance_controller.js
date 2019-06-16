'use strict';

angular.module('QuepidApp')
  .controller('QueryOptionsModalInstanceCtrl', [
    '$uibModalInstance',
    'value',
    function (
      $uibModalInstance,
      value
    ) {
      var ctrl = this;

      ctrl.value = value;

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.value);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
