'use strict';

angular.module('QuepidApp')
  .directive('importToCases', [
    function () {
      return {
        restrict:         'E',
        scope:            true,
        controller:       'ImportToCasesCtrl',
        controllerAs:     'ctrl',
        templateUrl:      'import_to_cases/import_to_cases.html',
      };
    }
  ]);
