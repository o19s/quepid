'use strict';

angular.module('QuepidApp')
  .controller('DeniedEditScorerModalInstanceCtrl', [
    '$window',
    '$uibModalInstance',
    function (
      $window,
      $uibModalInstance
    ) {
      var ctrl = this;

      ctrl.ok = function () {
        $window.location.href = '/';
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
