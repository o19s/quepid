'use strict';

angular.module('QuepidApp')
  .directive('removeScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'RemoveScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'remove_scorer/remove_scorer.html',
        scope:        {
          thisScorer: '=',
          thisTeam: '=',
        },
      };
    }
  ]);
