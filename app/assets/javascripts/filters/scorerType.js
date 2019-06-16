'use strict';

angular.module('QuepidApp')
  .filter('scorerType', [
    function () {
      return function (items, test) {
        if (test === 'test') {
          return items.filter(function(item) { return item.queryTest; });
        } else if (test === 'not_test') {
          return items.filter(function(item) { return !item.queryTest; });
        } else {
          return items;
        }
      };
    }
  ]);
