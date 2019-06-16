'use strict';

angular.module('QuepidApp')
  .directive('textPaste', [
    '$parse',
    function ($parse) {
      // Execute the expression within text-paste="<expr>"
      // and pass in any text pasted on this element to <expr>
      return function(scope, element, attrs) {
        var fn = $parse(attrs.textPaste);
           element.on('paste', function(event) {
             var pastedText = null;
             try {
                 pastedText = event.originalEvent.clipboardData.getData('text/plain');
             }
             catch (ex) {
                 // IE
                 if (!pastedText) {
                     pastedText = window.clipboardData.getData('Text');
                 }
             }
             if (pastedText) {
                 fn(scope, {$pastedText:pastedText});
             }
        });
      };
    }
  ]);
