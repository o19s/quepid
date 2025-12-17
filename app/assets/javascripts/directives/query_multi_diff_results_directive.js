'use strict';

angular.module('QuepidApp')
  .directive('queryDiffResults', [
    function () {
      return {
        controller:   'QueryDiffResultsCtrl',
        restrict:     'E',
        templateUrl:  'views/queryDiffResults.html',
        scope: {
          query: '=',
          repeatlength: '@',
          maxScore: '='
        }
      };
    }
  ]);