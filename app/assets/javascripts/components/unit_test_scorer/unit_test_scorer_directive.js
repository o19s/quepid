'use strict';

angular.module('QuepidApp')
  .directive('unitTestScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'UnitTestScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'unit_test_scorer/unit_test_scorer.html',
        scope:        {
          scorer: '=',
        },
      };
    }
  ]);
