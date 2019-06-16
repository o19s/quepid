'use strict';

angular.module('QuepidApp')
  .filter('queryStateClass', [
    function () {
      return function (input) {
        return 'queryHeader_' + input;
      };
    }
  ]);
