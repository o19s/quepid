'use strict';

angular.module('QuepidApp')
  .directive('queries', [
    function () {
      return {
        restrict: 'E',
        transclude: true,
        controller: 'QueriesCtrl',
        templateUrl: 'views/queries.html',
        replace: true
      };
    }
  ]);
