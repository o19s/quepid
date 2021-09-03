'use strict';

angular.module('QuepidApp')
  .controller('EditScorerModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'scorerControllerActionsSvc',
    'scorer',
    function (
      $scope,
      $uibModalInstance,
      scorerControllerActionsSvc,
      scorer
    ) {
      var ctrl        = this;
      ctrl.scorer     = scorer;
      ctrl.needToWarnOnScaleChange = true; // Editing scorers may have ratings already, so warn.

      scorerControllerActionsSvc.addActions(ctrl, $scope);

      scorerControllerActionsSvc.figureOutScaleChoice(ctrl);

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
