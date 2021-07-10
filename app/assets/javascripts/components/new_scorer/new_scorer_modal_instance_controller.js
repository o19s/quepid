'use strict';

angular.module('QuepidApp')
  .controller('NewScorerModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'scorerControllerActionsSvc',
    'defaultScorer',
    function (
      $scope,
      $uibModalInstance,
      scorerControllerActionsSvc,
      defaultScorer
    ) {
      var ctrl = this;
      ctrl.needToWarnOnScaleChange = false; // New scorers don't have any ratings, so no need to warn.

      scorerControllerActionsSvc.addActions(ctrl, $scope);

      ctrl.scaleChoice  = 'binaryScale';
      ctrl.scorer       = defaultScorer;

      ctrl.scorerOptions = {
        showName: true
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.scorer);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
