'use strict';

function toBoolean(value) {
  if (value && value.length !== 0) {
    var v = angular.lowercase('' + value);
    value = !(v === 'f' || v === '0' || v === 'false' || v === 'no' || v === 'n' || v === '[]');
  } else {
    value = false;
  }
  return value;
}

// This is just ng-if ported back to the
// ported back for my use
angular.module('UtilitiesModule')
  .directive('quepidIf', [
    function () {
      return {
        transclude: 'element',
        priority: 1000,
        terminal: true,
        restrict: 'A',
        compile: function(element, attr, transclude) {
          return function($scope, $element, $attr) {
            var childElement, childScope;
            $scope.$watch($attr.quepidIf, function quepidIfWatchAction(value) {
              if (childElement) {
                childElement.remove();
                childElement = undefined;
              }
              if (childScope) {
                childScope.$destroy();
                childScope = undefined;
              }
              if (toBoolean(value)) {
                childScope = $scope.$new();
                transclude(childScope, function(clone) {
                  childElement = clone;
                  $element.after(clone);
                });
              }
            });
          };
        }
      };
    }
  ]);
