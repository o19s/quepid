'use strict';

// Replacement for the vendored `ui-sortable` (angular-ui-sortable wrapping
// jQuery UI's $.fn.sortable()), using SortableJS (loaded onto
// window.Sortable from app/javascript/angular_app.js) so Quepid no longer
// needs jquery-ui-dist.
//
// Usage:
//   <ul quepid-sortable="queries.sortableOptions">
//     <li ng-class="query.isToggled() ? 'unsortable' : ''" ...>
//
// `queries.sortableOptions` is a plain object read once at link time (its
// properties may still be mutated later — `disabled` is watched):
//   { disabled: bool,
//     start:    function(),
//     stop:     function(oldIndex, newIndex) }
//
// Behavioral deltas vs the old jQuery-UI-backed directive:
//   - No cross-list ("connected sortables") support — Quepid never used it.
//   - No ng-model array splicing. The old directive spliced ngModel's array
//     to match the DOM purely for visual continuity; Quepid's list order is
//     actually driven by an `orderBy` on each item's own field (see
//     queriesCtrl's `sort`), so that splice never affected rendering and
//     isn't reproduced here.
//   - stop() receives plain DOM-relative (oldIndex, newIndex) instead of
//     jQuery UI's `ui.item.sortable.*` bag — index math (pagination offset,
//     reverse) still lives in queriesCtrl, unchanged.
//   - Rows matching `.unsortable` can't start a drag (SortableJS `filter`
//     option), mirroring the old `cancel: '.unsortable'` option.
angular.module('QuepidApp')
  .directive('quepidSortable', [
    function () {
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
          const Sortable = window.Sortable;
          if (!Sortable) {
            console.warn('quepidSortable: window.Sortable not available; drag-to-reorder will not work', element[0]);
            return;
          }

          const opts = scope.$eval(attrs.quepidSortable) || {};

          // SortableJS physically moves the dragged <li> (and its
          // descendants, including the query title's quepid-tooltip span)
          // between siblings as it's dragged over them. That reparenting
          // can swallow the mouseleave Bootstrap's `trigger: 'hover'`
          // tooltip relies on to hide itself, so a tooltip that popped up
          // mid-drag (tooltip-popup-delay is 1000ms — plenty of time while
          // dragging) is left stuck open after drop. Explicitly hide any
          // open tooltips in the list on start/end as a safety net.
          function hideTooltipsWithin(root) {
            const Tooltip = window.bootstrap && window.bootstrap.Tooltip;
            if (!Tooltip) { return; }
            root.querySelectorAll('[quepid-tooltip]').forEach(function (el) {
              const instance = Tooltip.getInstance(el);
              if (instance) { instance.hide(); }
            });
          }

          const sortable = Sortable.create(element[0], {
            animation: 150,
            direction: 'vertical',
            filter: '.unsortable',
            preventOnFilter: false,
            disabled: !!opts.disabled,
            onStart: function () {
              hideTooltipsWithin(element[0]);
              scope.$apply(function () {
                if (typeof opts.start === 'function') { opts.start(); }
              });
            },
            onEnd: function (evt) {
              hideTooltipsWithin(element[0]);
              scope.$apply(function () {
                if (typeof opts.stop === 'function') { opts.stop(evt.oldIndex, evt.newIndex); }
              });
            }
          });

          scope.$watch(function () { return opts.disabled; }, function (disabled) {
            sortable.option('disabled', !!disabled);
          });

          scope.$on('$destroy', function () {
            sortable.destroy();
          });
        }
      };
    }
  ]);
