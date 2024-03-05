'use strict';

angular.module('QuepidApp')
  .filter('scoreDisplay', [
    '$filter',
    function($filter) {
      return function(score) {
        console.log("in scoreDisplay.js: " + score);
        if ( angular.isNumber(score) ) {
          //console.log("score isNumber")
          return $filter('number')(score, 2);
        } else {
          //console.log("score is not a number: " + score)
          return score;
        }
      };
    }
  ]);
