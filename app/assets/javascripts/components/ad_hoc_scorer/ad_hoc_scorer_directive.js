'use strict';

angular.module('QuepidApp')
  .directive('adHocScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'AdHocScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'ad_hoc_scorer/ad_hoc_scorer.html',
        scope:        {
          scorer: '=',
        },
      };
    }
  ]);
