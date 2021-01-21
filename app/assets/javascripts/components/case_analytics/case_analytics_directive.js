'use strict';

angular.module('QuepidApp')
  .directive('caseAnalytics', [
    function () {
      return {
        restrict:     'E',
        controller:   'CaseAnalyticsCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'case_analytics/case_analytics.html',
        scope:        {
          thisCase: '=',
        },
      };
    }
  ]);
