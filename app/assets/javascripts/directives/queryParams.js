'use strict';

angular.module('QuepidApp')
  .directive('queryParams', [
    function () {
      return {
        scope: {
          settings: '='
        },
        controller: 'QueryParamsCtrl',
        restrict: 'E',
        templateUrl: 'views/devQueryParams.html'
      };
    }
  ]);
