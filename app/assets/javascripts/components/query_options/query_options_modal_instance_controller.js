'use strict';

angular.module('QuepidApp')
  .controller('QueryOptionsModalInstanceCtrl', [
    '$quepidModalInstance',
    'value',
    function (
      $quepidModalInstance,
      value
    ) {
      var ctrl = this;

      ctrl.value = JSON.stringify(value, null, 2);

      ctrl.ok = function () {
        $quepidModalInstance.close(ctrl.value);
      };

      ctrl.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
