'use strict';

angular.module('QuepidApp')
  .filter('chooseScoreClass', [
    function() {
      return function(headerOrRating) {
        if (headerOrRating === 'header') {
          return 'header-rating';
        } else {
          return 'overall-rating';
        }
      };
    }
  ]);