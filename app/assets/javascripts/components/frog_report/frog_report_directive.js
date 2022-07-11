'use strict';

angular.module('QuepidApp')
  .directive('frogReport', [
    function () {
      return {
        restrict:         'E',
        controller:       'FrogReportCtrl',
        controllerAs:     'ctrl',
        templateUrl:      'frog_report/frog_report.html',
        scope:        {
          theCase: '=',
          queriesSvc: '=',
          iconOnly: '=',
          supportsDetailedExport: '='
        }
      };
    }
  ]);
