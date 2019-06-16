'use strict';

angular.module('QuepidApp')
  .directive('lastScore', [
    function () {
      return {
        restrict:     'E',
        controller:   'LastScoreCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'last_score/last_score.html',
        scope:        {
          score: '=',
        },
      };
    }
  ]);
