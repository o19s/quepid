'use strict';

angular.module('QuepidApp')
  .directive('queries', [
    function () {
      return {
        restrict: 'E',
        transclude: true,
        controller: 'queriesCtrl',
        templateUrl: 'views/queries.html',
        replace: true
      };
    }
  ]);
