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

      scorerControllerActionsSvc.addActions(ctrl, $scope);

      if (customScorerSvc.scalesAreEqual(
        ctrl.scorer.scale, ctrl.scaleOptions.defaultScale
      )) {
        ctrl.scaleChoice = 'defaultScale';
      } else if (customScorerSvc.scalesAreEqual(
        ctrl.scorer.scale, ctrl.scaleOptions.shortScale
      )) {
        ctrl.scaleChoice = 'shortScale';
      } else if (customScorerSvc.scalesAreEqual(
        ctrl.scorer.scale, ctrl.scaleOptions.fibonacciScale
      )) {
        ctrl.scaleChoice = 'fibonacciScale';
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
