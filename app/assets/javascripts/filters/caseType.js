'use strict';

angular.module('QuepidApp')
  .filter('caseType', [
    function () {
      return function (items, test) {
        if ( test === 'owned' ) {
          return items.filter(function(item) { return item.owned; });
        } else if ( test === 'shared' ) {
          return items.filter(function(item) { return !item.owned; });
        } else {
          return items;
        }
      };
    }
  ]);
