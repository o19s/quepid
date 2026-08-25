'use strict';

// Static help icons (data-bs-content). Prefer over quepid-popover when text
// never changes; links per icon so ng-if/ng-show still works.

angular.module('QuepidApp')
  .directive('bsStaticPopover', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        const dom = window.quepidDom && window.quepidDom.popover;
        if (!dom) {
          console.warn('bsStaticPopover: window.quepidDom.popover not available', element[0]);
          return;
        }

        const el = element[0];
        const handle = dom.create(el, {
          mode: 'text',
          trigger: 'mouseenter',
          placement: attrs.bsPlacement || el.getAttribute('data-bs-placement') || 'right',
          body: attrs.bsContent || el.getAttribute('data-bs-content') || '',
          html: false
        });

        scope.$on('$destroy', function () {
          handle.dispose();
        });
      }
    };
  });
