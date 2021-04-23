'use strict';
angular.module('QuepidApp')
  .filter('stackChartColor', [
    function() {
      var colorClasses = ['red', 'orange', 'green', 'blue'];
      return function(input) {
        var idx = (input % colorClasses.length);
        return 'chart-area ' + colorClasses[idx];
      };
    }
  ]);

angular.module('QuepidApp')
  .filter('stackChartHeight', [
    function() {
      return function(input) {
        return {'height': input + '%'};
      };
    }
  ]);

angular.module('QuepidApp')
  .filter('stackChartLeftover', [
    function() {
      return function(allMatches) {
        var leftover = 100.0;
        angular.forEach(allMatches, function(match) {
          leftover -= match.percentage;
        });
        if (leftover < 0) {
          leftover = 0;
        }
        return {'height': leftover + '%'};
      };
    }
  ]);

angular.module('QuepidApp')
  .directive('stackedChart', [
    function () {
      return {
        restrict: 'E',
        priority: 1000,
        scope: {
            doc: '=',
            maxDocScore: '=',
            viewport: '='
          },
        templateUrl: 'views/stackedChart.html'
      };
    }
  ]);
