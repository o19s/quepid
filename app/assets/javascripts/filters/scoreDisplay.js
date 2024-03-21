'use strict';

angular.module('QuepidApp')
  .filter('scoreDisplay', [
    '$filter',
    function($filter) {
      return function(score) {
        if ( angular.isNumber(score) ) {
          return $filter('number')(score, 2);
        } else {
          return score;
        }
      };
    }
  ]);
