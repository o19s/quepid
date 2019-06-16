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
      /*TODO: I can't seem to get textarea to size decently withot rows/cols*/
        templateUrl: 'views/devQueryParams.html'
      };
    }
  ]);
