'use strict';

angular.module('QuepidApp')
  .directive('exportCase', [
    function () {
      return {
        restrict:         'E',
        controller:       'ExportCaseCtrl',
        controllerAs:     'ctrl',
        templateUrl:      'export_case/export_case.html',
        scope:        {
          theCase: '=',
          iconOnly: '='
        }
      };
    }
  ]);
