'use strict';

// uib-popover replacement — BS5 via quepidDom.popover (utils/bs_popover.js).
// Fixed `?` help icons: use bs-static-popover instead.
// outsideClick → manual trigger + capture listener; do not add our click
// toggle when the element already has ng-click.
// uib triggers: mouseenter → hover focus; outsideClick → manual.

(function () {
  const QUEPID = angular.module('QuepidApp');

  function linkPopover(scope, element, attrs, opts, $parse) {
    const dom = window.quepidDom && window.quepidDom.popover;
    if (!dom) {
      console.warn('quepidPopover: window.quepidDom.popover not available', element[0]);
      return;
    }

    const el = element[0];
    const trigger = dom.parseTrigger(attrs.popoverTrigger);
    const placement = dom.normalizePlacement(attrs.popoverPlacement);
    const delayMs = parseInt(attrs.popoverPopupDelay, 10);

    const hasIsOpen = !!attrs.popoverIsOpen;
    const isOpenGet = hasIsOpen ? $parse(attrs.popoverIsOpen) : null;
    const isOpenSet = (hasIsOpen && isOpenGet.assign) ? isOpenGet.assign : null;

    const handle = dom.create(el, {
      mode: opts.mode,
      trigger: trigger,
      placement: placement,
      delayMs: delayMs,
      title: attrs.popoverTitle,
      body: opts.mode === 'text' ? (attrs.quepidPopover || '') : '',
      html: opts.html !== false,
      hasIsOpen: hasIsOpen,
      hasNgClick: !!attrs.ngClick,
      getIsOpen: function () { return isOpenGet(scope); },
      setIsOpen: isOpenSet ? function (val) { isOpenSet(scope, val); } : null,
      scopeApply: function (fn) { scope.$apply(fn); },
      onTemplateShow: opts.mode === 'template' ? function () {
        opts.ensureCompiled(function () {
          const compiled = opts.getElement();
          if (compiled) {
            handle.setBody(compiled);
          }
        });
      } : null
    });

    if (attrs.popoverTitle !== undefined) {
      attrs.$observe('popoverTitle', function (val) {
        handle.setTitle(val);
      });
    }

    if (opts.mode === 'text') {
      attrs.$observe('quepidPopover', function (val) {
        handle.setBody(val);
      });
    }

    if (hasIsOpen && isOpenGet) {
      scope.$watch(function () { return isOpenGet(scope); }, function (val) {
        handle.showFromIsOpen(val);
      });
    }

    scope.$on('$destroy', function () {
      handle.dispose();
    });
  }

  QUEPID.directive('quepidPopover', ['$parse',
    function ($parse) {
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
          linkPopover(scope, element, attrs, { mode: 'text', html: false }, $parse);
        }
      };
    }
  ]);

  QUEPID.directive('quepidPopoverTemplate', ['$parse', '$compile', '$templateRequest', '$templateCache',
    function ($parse, $compile, $templateRequest, $templateCache) {
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
          const templateUrl = scope.$eval(attrs.quepidPopoverTemplate);
          let contentScope = null;
          let contentEl = null;

          // Compile lazily on first show — rating rows mount this on every result
          // but most popovers are never opened.
          function ensureCompiled(onReady) {
            if (contentEl) { onReady(); return; }
            const compileTemplate = function (html) {
              contentScope = scope.$new();
              const wrap = angular.element('<div>' + html + '</div>');
              $compile(wrap)(contentScope);
              contentEl = wrap[0];
              onReady();
              if (!scope.$root.$$phase) { scope.$apply(); }
            };
            const cached = $templateCache.get(templateUrl);
            if (cached) {
              compileTemplate(cached);
            } else {
              $templateRequest(templateUrl).then(compileTemplate);
            }
          }

          linkPopover(scope, element, attrs, {
            mode: 'template',
            html: true,
            getElement: function () { return contentEl; },
            ensureCompiled: ensureCompiled
          }, $parse);

          scope.$on('$destroy', function () {
            if (contentScope) { contentScope.$destroy(); }
          });
        }
      };
    }
  ]);
})();
