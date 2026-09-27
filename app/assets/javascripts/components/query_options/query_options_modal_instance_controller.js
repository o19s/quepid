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
        try {
          JSON.parse(ctrl.value);
        } catch (e) {
          window.quepidDom.flash.show('error', 'Please provide a valid JSON object.');
          return;
        }

        $quepidModalInstance.close(ctrl.value);
      };

      ctrl.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
