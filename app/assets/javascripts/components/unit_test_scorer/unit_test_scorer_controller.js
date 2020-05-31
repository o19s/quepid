'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('UnitTestScorerCtrl', [
    '$scope',
    'scorerControllerActionsSvc',
    'customScorerSvc',
    function (
      $scope,
      scorerControllerActionsSvc,
      customScorerSvc
    ) {
      var ctrl = this;
      ctrl.scorer = $scope.scorer;

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
        showName: false
      };
    }
  ]);
