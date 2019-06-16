'use strict';

// This  filter returns a background color style appropriate for a rating number
angular.module('QuepidApp')
  .filter('ratingBgStyle', [
    function() {
      return function(ratingObj) {
        var rating = ratingObj.rating;
        var scale;

        if (angular.isUndefined(ratingObj.scale)) {
          scale = {
            '1':  { color: '#c51800' },
            '2':  { color: '#e61f00' },
            '3':  { color: '#fe2400' },
            '4':  { color: '#fe5b00' },
            '5':  { color: '#ffad00' },
            '6':  { color: '#ffd600' },
            '7':  { color: '#bfd200' },
            '8':  { color: '#00c700' },
            '9':  { color: '#00af00' },
            '10': { color: '#008900' }
          };
        } else {
          scale = ratingObj.scale;
        }

        if (rating in scale) {
          var color = scale[rating].color;
          return {'background-color': color};
        }
        else {
          return {'background-color': '#777'};
        }
      };
    }
  ]);
