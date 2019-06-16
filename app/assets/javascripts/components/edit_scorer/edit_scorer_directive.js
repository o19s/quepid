'use strict';

angular.module('QuepidApp')
  .directive('editScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'EditScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'edit_scorer/edit_scorer.html',
        scope:        {
          scorer: '=',
        },
      };
    }
  ]);
