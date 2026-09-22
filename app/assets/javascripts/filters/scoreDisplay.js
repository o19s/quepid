'use strict';

// Score display formatting lives in app/javascript/utils/scoring.js (Vitest-covered).
angular.module('QuepidApp')
  .filter('scoreDisplay', [
    function() {
      return function(score) {
        return window.quepidSearch.scoring.formatDisplay(score);
      };
    }
  ]);
