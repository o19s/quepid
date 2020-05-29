'use strict';

angular.module('QuepidApp')
  .directive('exportEntireCase', [
    function () {
      return {
        restrict:         'E',
        controller:       'ExportEntireCaseCtrl',
        controllerAs:     'ctrl',
        templateUrl:      'export_entire_case/export_entire_case.html',
        scope:        {
          theCase: '=',
        }
      };
    }
  ]);
