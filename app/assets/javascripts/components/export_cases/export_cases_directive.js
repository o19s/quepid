'use strict';

angular.module('QuepidApp')
  .directive('exportCases', [
    function () {
      return {
        restrict:     'E',
        controller:   'ExportCasesCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'export_cases/export_cases.html',
        scope:        {
          caseList: '=',
        },
      };
    }
  ]);
