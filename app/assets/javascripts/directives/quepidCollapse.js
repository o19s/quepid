'use strict';

angular.module('QuepidApp')
  .directive('quepidCollapse', ['$timeout', function ($timeout) {
    // Matches the .35s transition baked into BS5 .collapsing rules.
    const DURATION = 350;

    return {
      link: function (scope, element, attrs) {
        const el = element[0];
        let pendingTimer = null;

        function clearTimer() {
          if (pendingTimer) {
            $timeout.cancel(pendingTimer);
            pendingTimer = null;
          }
        }

        function settle(expanded) {
          element.removeClass('collapsing show');
          element.addClass(expanded ? 'collapse show' : 'collapse');
          el.style.height = '';
          element.attr('aria-expanded', expanded ? 'true' : 'false');
          element.attr('aria-hidden', expanded ? 'false' : 'true');
        }

        function expand(animate) {
          clearTimer();
          if (!animate) {
            settle(true);
            return;
          }
          element.removeClass('collapse show').addClass('collapsing');
          el.style.height = '0px';
          void el.offsetHeight;
          el.style.height = el.scrollHeight + 'px';
          pendingTimer = $timeout(function () {
            pendingTimer = null;
            settle(true);
          }, DURATION, false);
        }

        function collapse(animate) {
          clearTimer();
          if (!animate) {
            settle(false);
            return;
          }
          el.style.height = el.scrollHeight + 'px';
          void el.offsetHeight;
          element.removeClass('collapse show').addClass('collapsing');
          el.style.height = '0px';
          pendingTimer = $timeout(function () {
            pendingTimer = null;
            settle(false);
          }, DURATION, false);
        }

        scope.$watch(attrs.quepidCollapse, function (newVal, oldVal) {
          const animate = newVal !== oldVal;
          if (newVal) {
            collapse(animate);
          } else {
            expand(animate);
          }
        });

        scope.$on('$destroy', clearTimer);
      }
    };
  }]);
