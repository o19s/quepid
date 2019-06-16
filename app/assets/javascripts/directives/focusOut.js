'use strict';

angular.module('QuepidApp')
  .directive('focusOut', [
    '$parse',
    function ($parse) {
      // Execute the expresion within focus-out="<expr>"
      // when this element loses focus
      //
      // Angular lets us just return the link function
      return function(scope, element, attrs) {
        var focusOutExpr = attrs.focusOut;
        var fn = $parse(focusOutExpr);
        element.bind('focusout', function(event) {
          scope.$apply(function() {
            fn(scope, {$event: event});
          });
        });
      };
    }
  ]);
