'use strict';

angular.module('QuepidApp')
  .directive('queriesStripped', [
    function () {
      return {
        restrict: 'E',
        transclude: true,
        controller: 'QueriesStrippedCtrl',
        templateUrl: 'views/queries-stripped.html',
        replace: true
      };
    }
  ]);
