'use strict';

// Replacement for angular-ui-bootstrap's `uib-popover` and `uib-popover-template`
// using Bootstrap 5's native Popover. Bootstrap is imported in
// app/javascript/angular_app.js so window.bootstrap.Popover is available here.
//
// Usage:
//   <span quepid-popover="Plain text"></span>
//   <span quepid-popover="..." popover-trigger="'mouseenter'" popover-placement="right"></span>
//   <div  quepid-popover-template="'views/ratings/popover.html'"
//         popover-trigger="outsideClick"
//         popover-placement="auto right"
//         popover-is-open="ratings.ratingsOn"></div>
//
//   popover-title="..."          (interpolation supported)
//   popover-popup-delay="500"    (ms; show delay only)
//
// Trigger mapping (uib → BS5):
//   'mouseenter'   → hover focus
//   'click'        → click            (BS5 default)
//   'focus'        → focus
//   'outsideClick' → manual + custom click toggle + document outside-click hide

(function () {
  const QUEPID = angular.module('QuepidApp');

  function parseTriggerAttr(raw) {
    if (!raw) { return 'click'; }
    return raw.trim().replace(/^['"]|['"]$/g, '');
  }

  function toBsTrigger(t) {
    switch (t) {
      case 'mouseenter':   return 'hover focus';
      case 'focus':        return 'focus';
      case 'click':        return 'click';
      case 'outsideClick': return 'manual';
      default:             return 'click';
    }
  }

  function linkPopover(scope, element, attrs, opts, $parse) {
    const Popover = window.bootstrap && window.bootstrap.Popover;
    if (!Popover) {
      console.warn('quepidPopover: window.bootstrap.Popover not available; popover will not render', element[0]);
      return;
    }

    const el      = element[0];
    const trigger = parseTriggerAttr(attrs.popoverTrigger);

    // BS5 placement does not accept compound 'auto right' from uib;
    // keep the directional half so 'auto right' becomes 'right'.
    const placement = (attrs.popoverPlacement || 'top').split(/\s+/).pop();
    const delayMs   = parseInt(attrs.popoverPopupDelay, 10);

    const hasIsOpen = !!attrs.popoverIsOpen;
    const isOpenGet = hasIsOpen ? $parse(attrs.popoverIsOpen) : null;
    const isOpenSet = (hasIsOpen && isOpenGet.assign) ? isOpenGet.assign : null;

    // popover-is-open and outsideClick both need us to drive show/hide,
    // so override BS5's trigger to manual in those cases.
    const bsTrigger = (hasIsOpen || trigger === 'outsideClick') ?
      'manual' :
      toBsTrigger(trigger);

    // Track current header/body in closures and always pass both to setContent.
    // Required because BS5's templateFactory merges via Object spread, so
    // partial updates accumulate — but our `null`-removes-element trick for
    // empty headers depends on every rebuild seeing a fresh map.
    let currentTitle = '';
    let currentBody  = opts.mode === 'text' ? (attrs.quepidPopover || '') : '';

    const instance = new Popover(el, {
      placement: placement,
      trigger:   bsTrigger,
      html:      opts.html !== false,
      delay:     isFinite(delayMs) ? { show: delayMs, hide: 0 } : 0,
      container: 'body',
      title:     ' ',
      content:   currentBody || ' '
    });

    function refreshContent() {
      instance.setContent({
        '.popover-header': currentTitle || null,
        '.popover-body':   currentBody || ' '
      });
    }

    if (attrs.popoverTitle !== undefined) {
      attrs.$observe('popoverTitle', function (val) {
        currentTitle = val || '';
        refreshContent();
      });
    }

    if (opts.mode === 'text') {
      attrs.$observe('quepidPopover', function (val) {
        currentBody = val || '';
        refreshContent();
      });
    } else {
      // Template mode: re-attach compiled element on every show. The element
      // is the same instance across shows, so Angular bindings stay live.
      el.addEventListener('show.bs.popover', function () {
        const compiled = opts.getElement();
        if (compiled) {
          currentBody = compiled;
          refreshContent();
        }
      });
    }

    // popover-is-open two-way binding.
    let suppress = false;
    if (hasIsOpen) {
      scope.$watch(function () { return isOpenGet(scope); }, function (val) {
        suppress = true;
        if (val) { instance.show(); }
        else     { instance.hide(); }
        suppress = false;
      });

      const onShown  = function () {
        if (suppress || !isOpenSet || isOpenGet(scope) === true) { return; }
        scope.$apply(function () { isOpenSet(scope, true); });
      };
      const onHidden = function () {
        if (suppress || !isOpenSet || isOpenGet(scope) === false) { return; }
        scope.$apply(function () { isOpenSet(scope, false); });
      };
      el.addEventListener('shown.bs.popover',  onShown);
      el.addEventListener('hidden.bs.popover', onHidden);
    }

    // outsideClick: hide whenever a click lands outside the trigger AND
    // outside the rendered popover. BS5 has no built-in equivalent.
    let docHandler = null;
    if (trigger === 'outsideClick') {
      docHandler = function (ev) {
        const tipId = el.getAttribute('aria-describedby');
        const tip   = tipId ? document.getElementById(tipId) : null;
        if (!tip) { return; }
        if (el.contains(ev.target) || tip.contains(ev.target)) { return; }
        if (hasIsOpen && isOpenSet) {
          scope.$apply(function () { isOpenSet(scope, false); });
        } else {
          instance.hide();
        }
      };
      // Capture phase so we beat handlers that stopPropagation.
      document.addEventListener('click', docHandler, true);
    }

    // outsideClick: BS5 trigger is manual, so the trigger element needs its
    // own click handler. Skip wiring if the markup already has ng-click —
    // that callback is the user's open path, and adding our own would race
    // with it on the same click event.
    let elClickHandler = null;
    if (trigger === 'outsideClick' && !attrs.ngClick) {
      elClickHandler = (hasIsOpen && isOpenSet) ?
        function () { scope.$apply(function () { isOpenSet(scope, !isOpenGet(scope)); }); } :
        function () { instance.toggle(); };
      el.addEventListener('click', elClickHandler);
    }

    scope.$on('$destroy', function () {
      if (docHandler)     { document.removeEventListener('click', docHandler, true); }
      if (elClickHandler) { el.removeEventListener('click', elClickHandler); }
      instance.dispose();
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
          const contentScope = scope.$new();
          const templateUrl  = scope.$eval(attrs.quepidPopoverTemplate);
          let   contentEl    = null;

          const compileTemplate = function (html) {
            const wrap = angular.element('<div>' + html + '</div>');
            $compile(wrap)(contentScope);
            contentEl = wrap[0];
          };

          const cached = $templateCache.get(templateUrl);
          if (cached) {
            compileTemplate(cached);
          } else {
            $templateRequest(templateUrl).then(compileTemplate);
          }

          linkPopover(scope, element, attrs, {
            mode: 'template',
            html: true,
            getElement: function () { return contentEl; }
          }, $parse);

          scope.$on('$destroy', function () {
            contentScope.$destroy();
          });
        }
      };
    }
  ]);
})();
