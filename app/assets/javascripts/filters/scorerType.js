'use strict';
// Look through a list of scorers and identify the unit test style ones.
angular.module('QuepidApp')
  .filter('scorerType', [
    function () {
      return function (items, test) {
        if (test === 'communal') {
          return items.filter(function(item) { return item.communal; });
        } else if (test === 'custom') {
          return items.filter(function(item) { return !item.communal; });
        } else {
          return items;
        }
      };
    }
  ]);
