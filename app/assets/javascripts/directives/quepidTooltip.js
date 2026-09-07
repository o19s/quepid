'use strict';

// uib-tooltip replacement — BS5 via quepidDom.tooltip (utils/bs_tooltip.js).
// Interpolated content needs quepid-tooltip="{{tip}}" so $observe sees updates.

angular.module('QuepidApp')
  .directive('quepidTooltip', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        const dom = window.quepidDom && window.quepidDom.tooltip;
        if (!dom) {
          console.warn('quepidTooltip: window.quepidDom.tooltip not available', element[0]);
          return;
        }

        const el = element[0];
        const isHtml = 'quepidTooltipHtml' in attrs;
        const placement = attrs.tooltipPlacement || 'top';
        const delayMs = parseInt(attrs.tooltipPopupDelay, 10);

        const instance = dom.create(el, {
          title: attrs.quepidTooltip || '',
          placement: placement,
          html: isHtml,
          delayMs: delayMs
        });

        attrs.$observe('quepidTooltip', function (val) {
          dom.updateContent(instance, val);
        });

        scope.$on('$destroy', function () {
          dom.dispose(instance);
        });
      }
    };
  });
