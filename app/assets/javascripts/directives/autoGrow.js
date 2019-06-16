'use strict';

angular.module('QuepidApp')
  .directive('autoGrow', [
    function () {
      return function(scope, element) {
        element.autoGrowInput({
          minWidth:    50,
          maxWidth:    200,
          comfortZone: 30,
        });
      };
    }
  ]);
