'use strict';

angular.module('QuepidApp')
  .directive('queryOptions', [
    function () {
      return {
        restrict:     'E',
        controller:   'QueryOptionsCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'query_options/query_options.html',
        scope:        {
          query: '=',
        },
      };
    }
  ]);
