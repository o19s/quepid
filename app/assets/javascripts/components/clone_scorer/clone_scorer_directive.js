'use strict';

angular.module('QuepidApp')
  .directive('cloneScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'CloneScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'clone_scorer/clone_scorer.html',
        scope:        {
          buttonText: '=',
          scorer: '=',
        },
      };
    }
  ]);
