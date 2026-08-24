'use strict';

/**
 * Limits an array of case objects to `owned` or `shared` (non-owned) for display lists; passes
 * through unchanged when the filter name is not one of those two tags.
 */

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
