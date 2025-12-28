'use strict';

angular.module('QuepidApp')
  .controller('DeniedEditScorerModalInstanceCtrl', [
    '$window',
    '$uibModalInstance',
    'caseTryNavSvc',
    function (
      $window,
      $uibModalInstance,
      caseTryNavSvc
    ) {
      var ctrl = this;

      ctrl.ok = function () {
        $window.location.href = caseTryNavSvc.getQuepidRootUrl();
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
