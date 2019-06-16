'use strict';

angular.module('QuepidApp')
  .directive('queryDiffResults', [
    function () {
      return {
        restrict: 'E',
        transclude: true,
        scope: {
          /*diffQuery: '=diffquery'*/
          query: '=',
          repeatlength: '=',
          diffExplainView: '='
        },
        controller: 'QueryDiffResultsCtrl',
        templateUrl: 'views/queryDiffResults.html'
      };
    }
  ]);
