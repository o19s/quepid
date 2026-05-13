'use strict';

// Replacement for angular-ui-bootstrap's $uibModal, wrapping Bootstrap 5's
// native bootstrap.Modal. window.bootstrap is pinned in
// app/javascript/angular_app.js so this service can reach Modal the same way
// quepidPopover/quepidTooltip reach Popover/Tooltip.
//
// Surface kept (every option Quepid call sites actually use):
//   open({ template? | templateUrl,
//          controller?, controllerAs?, bindToController?,
//          resolve?, scope?,
//          size?           // 'sm' | 'lg' → adds .modal-sm/.modal-lg
//          windowClass?,   // extra class on the outer .modal
//          backdrop?,      // true | false | 'static'
//          keyboard?       // boolean
//          ariaLabelledBy?, // id of modal title heading (accessible name for role="dialog")
//        })
//   → { result: Promise, close(value), dismiss(reason) }
//
// Surface intentionally NOT carried over (no caller in app code uses any of
// these — verified by grep, see docs/archived/bootstrap_angular_plugins_full.md § Modal):
//   component:, windowTemplateUrl:, appendTo:, backdropClass:,
//   ariaDescribedBy:, openedClass:, windowTopClass:,
//   animation:, instance.opened/.closed/.rendered, the modal.closing veto
//   event, $uibModalStack/$uibResolve internals. (`ariaLabelledBy` from uib maps
//   to opts.ariaLabelledBy → `aria-labelledby` on the `.modal`; pass the id of
//   `.modal-title` when modals expose one.)

(function () {
  angular.module('QuepidApp').factory('$quepidModal', [
    '$q', '$rootScope', '$controller', '$compile', '$injector',
    '$templateRequest', '$templateCache', '$document',
    function ($q, $rootScope, $controller, $compile, $injector,
              $templateRequest, $templateCache, $document) {

      function getTemplate(opts) {
        if (opts.template) { return $q.when(opts.template); }
        const cached = $templateCache.get(opts.templateUrl);
        if (cached) { return $q.when(cached); }
        return $templateRequest(opts.templateUrl);
      }

      function resolveLocals(resolveMap) {
        const keys = Object.keys(resolveMap || {});
        const promises = keys.map(function (key) {
          const v = resolveMap[key];
          if (angular.isString(v)) { return $q.when($injector.get(v)); }
          if (angular.isFunction(v) || angular.isArray(v)) {
            return $q.when($injector.invoke(v));
          }
          // Raw value pass-through — uib supports `resolve: { foo: 42 }`.
          return $q.when(v);
        });
        return $q.all(promises).then(function (values) {
          const out = {};
          keys.forEach(function (k, i) { out[k] = values[i]; });
          return out;
        });
      }

      // $apply that's safe to call from any context. Promise settlement
      // from a raw DOM event (BS5's hidden.bs.modal) needs a digest so
      // result.then handlers run; from inside an existing digest we'd
      // double-throw, so check $$phase first. Mirrors the $apply uib used
      // for its keydown handler. Note: this assumes BS5's
      // executeAfterTransition runs the callback synchronously when
      // animation is off (true in v5.x; revisit on minor bumps).
      function safeApply(fn) {
        if ($rootScope.$$phase) { fn(); }
        else { $rootScope.$apply(fn); }
      }

      function open(opts) {
        const Modal = window.bootstrap && window.bootstrap.Modal;
        if (!Modal) {
          throw new Error('$quepidModal shim: window.bootstrap.Modal not available');
        }
        if (!opts.template && !opts.templateUrl) {
          throw new Error('$quepidModal shim: template or templateUrl is required');
        }

        const resultDeferred = $q.defer();
        let settled = false;

        // Build the wrapper up front so BS5 Modal has a real target. The
        // template content is injected (and Angular-compiled) once template +
        // resolves arrive. uib's window.html does the equivalent wrapping —
        // .modal > .modal-dialog[.modal-{size}] > .modal-content — and many
        // templates start at .modal-header expecting that hierarchy.
        const sizeClass = opts.size ? ('modal-' + opts.size) : '';
        const wrapper   = angular.element(
          '<div class="modal" tabindex="-1" role="dialog">' +
            '<div class="modal-dialog ' + sizeClass + '" role="document">' +
              '<div class="modal-content"></div>' +
            '</div>' +
          '</div>'
        );
        if (opts.windowClass) { wrapper.addClass(opts.windowClass); }
        if (opts.ariaLabelledBy) {
          wrapper.attr('aria-labelledby', opts.ariaLabelledBy);
        }
        $document.find('body').eq(0).append(wrapper);

        const wrapperEl = wrapper[0];
        const contentEl = wrapperEl.querySelector('.modal-content');

        // No `class="fade"` on the wrapper — BS3's `.fade { opacity: 0 }`
        // has no `.fade.show` counterpart in core.css (CLAUDE.md gotcha #3),
        // so an animated modal would render invisible. BS5 reads the class
        // off the element to decide whether to animate; with no `.fade`,
        // it skips the transition and the backdrop is shown immediately.
        const bsModal = new Modal(wrapperEl, {
          backdrop: opts.backdrop !== undefined ? opts.backdrop : true,
          keyboard: opts.keyboard !== undefined ? opts.keyboard : true,
          focus:    true
        });

        const instance = {
          result: resultDeferred.promise,
          close: function (value) {
            if (settled) { return; }
            settled = true;
            resultDeferred.resolve(value);
            bsModal.hide();
          },
          dismiss: function (reason) {
            if (settled) { return; }
            settled = true;
            resultDeferred.reject(reason);
            bsModal.hide();
          }
        };

        const modalScope = (opts.scope || $rootScope).$new();
        // uib exposes $close / $dismiss on the modal scope so templates can
        // use ng-click="$close()" without going through controller methods.
        modalScope.$close   = instance.close;
        modalScope.$dismiss = instance.dismiss;

        // NOTE: uib registered a `modalScope.$on('$destroy')` handler that
        // auto-dismissed the modal if the scope died externally (route
        // change with a modal open, etc.). We skip it here because:
        //   1. No Quepid call site passes `opts.scope`, so modalScope is
        //      always a $rootScope child — and $rootScope is not destroyed
        //      during normal app lifetime.
        //   2. Adding the handler caused the karma teardown of $rootScope's
        //      child scopes to re-enter dismiss → bsModal.hide → scope
        //      traversal, which trips a `$$nextSibling` null deref because
        //      the scope chain is mid-unwind. Add only with care.

        // BS5 fires hidden.bs.modal for any close (explicit, backdrop, ESC).
        // If neither close() nor dismiss() ran, the user dismissed via
        // backdrop or keyboard — match uib's reason string.
        // Wrapped in $apply because hidden.bs.modal is a raw DOM event,
        // outside any digest, and result.then handlers need a digest to run.
        function onHidden() {
          safeApply(function () {
            if (!settled) {
              settled = true;
              resultDeferred.reject('backdrop click');
            }
            teardown();
            // BS5's _hideModal unconditionally strips `modal-open` from
            // <body> when any modal closes — it doesn't track a stack.
            // For nested modals (Quepid does this in targetedSearchModal
            // and the diff modal, both of which embed <search-result>
            // rows whose info-button opens detailedDoc.html), closing the
            // inner modal would release the outer's scroll lock. Re-apply
            // here if any other modal is still showing. uib used
            // $$stackedMap for the same purpose.
            if (document.querySelector('.modal.show')) {
              document.body.classList.add('modal-open');
            }
          });
        }

        // Tear down DOM + scope + BS5 instance. removeEventListener is a
        // no-op if onHidden already detached, so calling teardown more than
        // once is safe.
        function teardown() {
          wrapperEl.removeEventListener('hidden.bs.modal', onHidden);
          modalScope.$destroy();
          bsModal.dispose();
          wrapper.remove();
        }

        wrapperEl.addEventListener('hidden.bs.modal', onHidden);

        $q.all({
          tpl:      getTemplate(opts),
          resolved: resolveLocals(opts.resolve)
        }).then(function (got) {
          // Caller dismissed/closed before resolves arrived — don't show.
          if (settled) { teardown(); return; }

          try {
            const locals = angular.extend({
              $scope:            modalScope,
              $quepidModalInstance: instance
            }, got.resolved);

            if (opts.controller) {
              const ctrl = $controller(opts.controller, locals);
              if (opts.controllerAs) {
                modalScope[opts.controllerAs] = ctrl;
                if (opts.bindToController) {
                  ctrl.$close   = instance.close;
                  ctrl.$dismiss = instance.dismiss;
                }
              }
              if (angular.isFunction(ctrl.$onInit)) { ctrl.$onInit(); }
            }

            // Re-check after controller construction. If $onInit (or the
            // constructor) called $quepidModalInstance.dismiss() synchronously,
            // bsModal.hide() ran on an unshown modal — a no-op that doesn't
            // fire hidden.bs.modal — so without this guard we'd call show()
            // on an already-rejected modal. Same applies if a watcher fires
            // $close/$dismiss during the post-$compile digest below.
            if (settled) { teardown(); return; }

            contentEl.innerHTML = got.tpl;
            $compile(contentEl)(modalScope);
            if (settled) { teardown(); return; }

            // Stack-aware z-index for nested modals. BS3/BS5 both default
            // .modal to z-index 1050 and .modal-backdrop to 1040, so two
            // open modals would tie and the inner backdrop would render
            // *under* the outer modal — leaving outer-modal buttons
            // clickable while the inner is open. Quepid does nest modals
            // (targetedSearchModal and the diff modal embed <search-result>
            // rows whose info button opens detailedDoc.html), so bump per
            // already-shown modal. Outer keeps the BS3 defaults; each
            // additional layer adds 20. Backdrop is created synchronously
            // by BS5 during show() with animation off, so we can grab the
            // most-recent .modal-backdrop right after show() returns.
            const stackIdx = document.querySelectorAll('.modal.show').length;
            if (stackIdx > 0) { wrapperEl.style.zIndex = 1050 + stackIdx * 20; }
            bsModal.show();
            if (stackIdx > 0) {
              const backdrops = document.querySelectorAll('.modal-backdrop');
              const ours = backdrops[backdrops.length - 1];
              if (ours) { ours.style.zIndex = 1040 + stackIdx * 20; }
            }
          } catch (err) {
            // Controller construction or compile threw — abandon the open.
            if (!settled) {
              settled = true;
              resultDeferred.reject(err);
            }
            teardown();
            throw err; // surface to console / Angular's $exceptionHandler
          }
        }, function (err) {
          // Template fetch or resolve rejected — tear down without showing.
          if (!settled) {
            settled = true;
            resultDeferred.reject(err);
          }
          teardown();
        });

        return instance;
      }

      return { open: open };
    }
  ]);
})();
