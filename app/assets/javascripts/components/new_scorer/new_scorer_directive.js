'use strict';

angular.module('QuepidApp')
  .directive('newScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'NewScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'new_scorer/new_scorer.html',
        scope:        {
          buttonText: '=',
        },
      };
    }
  ]);
