'use strict';

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

        controller: 'SearchResultsCtrl',
        templateUrl: 'views/searchResults.html',
        replace: true
      };
    }
  ]);
