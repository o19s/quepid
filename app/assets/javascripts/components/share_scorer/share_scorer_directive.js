'use strict';

angular.module('QuepidApp')
  .directive('shareScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'ShareScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'share_scorer/share_scorer.html',
        scope:        {
          scorer: '=',
        },
      };
    }
  ]);
