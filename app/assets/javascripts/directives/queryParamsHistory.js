'use strict';

angular.module('QuepidApp')
  .directive('queryParamsHistory', [
    function () {
      return {
        scope: {
          settings: '='
        },
        controller: 'queryParamsHistoryCtrl',
        restrict: 'E',
        templateUrl: 'views/queryParamsHistory.html'
      };
    }
  ]);
