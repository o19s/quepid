'use strict';

angular.module('QuepidApp')
  .filter('scoreDisplay', [
    '$filter',
    function($filter) {
      return function(score) {
        if (score === '?') {
          return '?';
        } else if ( angular.isNumber(score) ) {
          return $filter('number')(score, 0);
        } else {
          return score;
        }
      };
    }
  ]);
