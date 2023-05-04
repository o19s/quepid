'use strict';

angular.module('QuepidApp')
  .directive('customHeaders', [
    function () {
      return {
        scope: {
          settings: '='
        },
        controller: 'CustomHeadersCtrl',
        restrict: 'E',
        templateUrl: 'views/customHeaders.html'
      };
    }
  ]);
