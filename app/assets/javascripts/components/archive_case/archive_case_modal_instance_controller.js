'use strict';

angular.module('QuepidApp')
  .controller('ArchiveCaseModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    'theCase',
    function ($rootScope, $uibModalInstance, theCase) {
      var ctrl = this;

      ctrl.theCase = theCase;      

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
