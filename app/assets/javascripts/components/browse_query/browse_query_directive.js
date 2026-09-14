'use strict';

angular.module('QuepidApp')
  .directive('browseQuery', [
    function () {
      return {
        restrict:     'E',
        controller:   'BrowseQueryCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'browse_query/browse_query.html',
        scope:        {
          query: '=',
          selectedTry: '=',
        },
      };
    }
  ]);
