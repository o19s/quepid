'use strict';

angular.module('QuepidApp')
  .directive('queryAnalytics', [
    function () {
      return {
        restrict:     'E',
        controller:   'QueryAnalyticsCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'query_analytics/query_analytics.html',
        scope:        {
          thisQuery: '=',
        },
      };
    }
  ]);
