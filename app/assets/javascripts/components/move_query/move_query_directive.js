'use strict';

angular.module('QuepidApp')
  .directive('moveQuery', [
    function () {
      return {
        restrict:     'E',
        controller:   'MoveQueryCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'move_query/move_query.html',
        scope:        {
          query: '=',
        },
      };
    }
  ]);
