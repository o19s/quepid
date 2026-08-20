'use strict';

angular.module('QuepidApp')
  .controller('DeleteCaseModalInstanceCtrl', [
    '$rootScope',
    '$quepidModalInstance',
    function ($rootScope, $quepidModalInstance) {
      var ctrl = this;

      ctrl.ok = function () {
        $quepidModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $quepidModalInstance.close(false);
      };

    }
  ]);
