'use strict';

angular.module('QuepidApp')
  .filter('isImageUrl', function() {
    return function(url) {
      return typeof url === 'string' && /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
    };
  });
