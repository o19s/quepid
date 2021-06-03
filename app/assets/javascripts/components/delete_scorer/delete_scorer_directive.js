'use strict';

angular.module('QuepidApp')
  .directive('deleteScorer', [
    function () {
      return {
        restrict:     'E',
        controller:   'DeleteScorerCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'delete_scorer/delete_scorer.html',
        scope:        {
          thisScorer: '=',
        },
      };
    }
  ]);
