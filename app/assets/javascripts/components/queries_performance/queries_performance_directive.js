'use strict';

angular.module('QuepidApp')
  .directive('queriesPerformance', [
    function () {
      return {
        restrict:         'E',
        controller:       'QueriesPerformanceCtrl',
        controllerAs:     'ctrl',
        templateUrl:      'queries_performance/queries_performance.html',
        scope:        {
          theCase: '=',
          queriesSvc: '=',
          iconOnly: '=',
          supportsDetailedExport: '='
        }
      };
    }
  ]);
