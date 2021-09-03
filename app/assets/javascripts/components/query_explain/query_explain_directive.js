'use strict';

angular.module('QuepidApp')
  .directive('queryExplain', [
    function () {
      return {
        restrict:     'E',
        controller:   'QueryExplainCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'query_explain/query_explain.html',
        scope:        {
          query: '=',
        },
      };
    }
  ]);
