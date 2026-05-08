'use strict';

angular.module('QuepidApp')
  .filter('plusOrMinus', [
    function() {
      return function(toggled) {
        if (toggled) {
          return 'bi-chevron-up';
        }
        else {
          return 'bi-chevron-down';
        }
      };
    }
  ]);

angular.module('QuepidApp')
  .directive('searchResults', [
    function () {
      return {
        restrict: 'E',
        transclude: true,
        scope: {
          query: '=',
          isSortingEnabled: '=issortingenabled'
        },

        link: function(scope, element) {
          var queryHeader = element.find('h2');
          queryHeader.click(function() {
            scope.$apply(function() {
              if(!scope.isSortingEnabled()){
                scope.query.toggle();
              }
            });
          });
        },

        controller: 'SearchResultsCtrl',
        templateUrl: 'views/searchResults.html',
        replace: true
      };
    }
  ]);
