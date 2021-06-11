'use strict';

angular.module('QuepidApp')
  .controller('EditScorerModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'customScorerSvc',
    'scorerControllerActionsSvc',
    'scorer',
    function (
      $scope,
      $uibModalInstance,
      customScorerSvc,
      scorerControllerActionsSvc,
      scorer
    ) {
      var ctrl        = this;
      ctrl.scorer     = scorer;
      ctrl.needToWarnOnScaleChange = true; // Editing scorers may have ratings already, so warn.

      scorerControllerActionsSvc.addActions(ctrl, $scope);

      if (customScorerSvc.scalesAreEqual(
        ctrl.scorer.scale, ctrl.scaleOptions.detailScale
      )) {
        ctrl.scaleChoice = 'detailScale';
      } else if (customScorerSvc.scalesAreEqual(
        ctrl.scorer.scale, ctrl.scaleOptions.gradedScale
      )) {
        ctrl.scaleChoice = 'gradedScale';
      } else if (customScorerSvc.scalesAreEqual(
        ctrl.scorer.scale, ctrl.scaleOptions.binaryScale
      )) {
        ctrl.scaleChoice = 'binaryScale';
      } else  {
        ctrl.scaleChoice = 'custom';
      }

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
