'use strict';

// Replacement for angular-ui-bootstrap's `uib-tooltip` / `uib-tooltip-html`,
// using Bootstrap 5's native Tooltip. Bootstrap is imported in
// app/javascript/angular_app.js so window.bootstrap.Tooltip is available here.
//
// Usage:
//   <a quepid-tooltip="Plain text"></a>
//   <a quepid-tooltip="<b>HTML</b> allowed" quepid-tooltip-html></a>
//   tooltip-placement="left|right|top|bottom"   (default 'top')
//   tooltip-popup-delay="1000"                  (default 0, in ms)

angular.module('QuepidApp')
  .directive('quepidTooltip', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        const Tooltip = window.bootstrap && window.bootstrap.Tooltip;
        if (!Tooltip) {
          // Loud failure beats silent — if you see this, Bootstrap 5's JS
          // didn't make it into window.bootstrap on this page. Check that
          // app/javascript/angular_app.js still does the namespace import.
          console.warn('quepidTooltip: window.bootstrap.Tooltip not available; tooltip will not render', element[0]);
          return;
        }

        const el = element[0];
        const isHtml = 'quepidTooltipHtml' in attrs;
        const placement = attrs.tooltipPlacement || 'top';
        const delayMs = parseInt(attrs.tooltipPopupDelay, 10);

        const instance = new Tooltip(el, {
          title: attrs.quepidTooltip || '',
          placement: placement,
          html: isHtml,
          trigger: 'hover focus',
          delay: isFinite(delayMs) ? { show: delayMs, hide: 0 } : 0,
          container: 'body'
        });

        attrs.$observe('quepidTooltip', function (val) {
          // setContent landed in Bootstrap 5.2; we are on 5.3+.
          instance.setContent({ '.tooltip-inner': val || '' });
        });

        scope.$on('$destroy', function () {
          instance.dispose();
        });
      }
    };
  });
