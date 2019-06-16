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

      scorerControllerActionsSvc.addActions(ctrl, $scope);

      ctrl.scaleChoice  = 'defaultScale';
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
