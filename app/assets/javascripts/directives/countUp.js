'use strict';

// Replacement for the removed angular-countup vendor directive. Delegates
// the actual stepped animation to utils/count_up.js via window.quepidDom —
// Angular's own $watch already hands us oldVal === newVal on the first
// call, so the initial render never animates.
//
// Usage: <span count-up="query.getNumFound()"></span>

angular.module('QuepidApp')
  .directive('countUp', function () {
    return {
      restrict: 'A',
      scope: {
        countUp: '='
      },
      link: function (scope, element) {
        const dom = window.quepidDom && window.quepidDom.countUp;
        if (!dom) {
          console.warn('countUp: window.quepidDom.countUp not available', element[0]);
          return;
        }

        const el = element[0];

        scope.$watch('countUp', function (newValue, oldValue) {
          dom.animate(el, oldValue, newValue);
        });

        scope.$on('$destroy', function () {
          dom.stop(el);
        });
      }
    };
  });
