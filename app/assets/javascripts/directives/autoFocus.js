'use strict';

angular.module('QuepidApp')
  .directive('autoFocus', [
    '$parse', '$timeout',
    function ($parse, $timeout) {
      // Execute the expression within focus-out="<expr>"
      // when this element loses focus
      //
      // Angular lets us just return the link function
      return function(scope, element, attrs) {
        var model = $parse(attrs.autoFocus);
        scope.$watch(model, function(value) {
          if (value) {
            $timeout(function() {
              element[0].focus();
            });
          }
        });
      };
    }
  ]);
