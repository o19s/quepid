'use strict';

angular.module('QuepidApp')
  .controller('QueryOptionsModalInstanceCtrl', [
    '$quepidModalInstance',
    'flash',
    'value',
    function (
      $quepidModalInstance,
      flash,
      value
    ) {
      var ctrl = this;

      ctrl.value = JSON.stringify(value, null, 2);

      ctrl.ok = function () {
        try {
          JSON.parse(ctrl.value);
        } catch (e) {
          flash.error = 'Please provide a valid JSON object.';
          return;
        }

        $quepidModalInstance.close(ctrl.value);
      };

      ctrl.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
