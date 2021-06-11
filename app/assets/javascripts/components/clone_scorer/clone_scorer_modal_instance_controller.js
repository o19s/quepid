'use strict';

angular.module('QuepidApp')
  .controller('CloneScorerModalInstanceCtrl', [
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
      var ctrl = this;
      ctrl.needToWarnOnScaleChange = false; // New scorers don't have any ratings, so no need to warn.

      ctrl.scorer       = angular.copy(scorer);
      ctrl.scorer.name = 'Clone of ' + ctrl.scorer.name;

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
