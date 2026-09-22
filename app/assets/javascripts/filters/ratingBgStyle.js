'use strict';

// This filter returns a background color style appropriate for a rating number.
// Rule lives in app/javascript/utils/scoring.js (Vitest-covered).
angular.module('QuepidApp')
  .filter('ratingBgStyle', [
    function() {
      return function(ratingObj) {
        return window.quepidSearch.scoring.ratingBackgroundColor(ratingObj);
      };
    }
  ]);
