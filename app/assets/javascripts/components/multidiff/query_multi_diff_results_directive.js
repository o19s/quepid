'use strict';

angular.module('QuepidApp')
  .directive('queryMultiDiffResults', [
    function () {
      return {
        controller:   'QueryMultiDiffResultsCtrl',
        restrict:     'E',
        templateUrl:  'views/queryMultiDiffResults.html',
        scope: {
          query: '=',
          repeatlength: '@'
        }
      };
    }
  ]);