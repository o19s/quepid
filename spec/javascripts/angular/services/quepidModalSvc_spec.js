'use strict';

describe('Service: $quepidModal', function () {

  beforeEach(module('QuepidTest'));

  /* jshint camelcase: false */
  var $quepidModal, $rootScope, scope;

  beforeEach(inject(function (_$quepidModal_, _$rootScope_) {
    $quepidModal = _$quepidModal_;
    $rootScope   = _$rootScope_;
    scope        = $rootScope.$new();
  }));

  // NOTE: other specs in this suite (e.g. promptSnapshot_spec.js) open real
  // $quepidModal instances and spy over close() without ever tearing the
  // real BS5 modal down, so leftover .modal/.modal-backdrop elements from
  // other files can be present in karma's single shared document. Every
  // assertion below holds a direct element reference (captured the instant
  // open() appends it) rather than a global `.modal`/`.modal-backdrop`
  // query, so it can't be confused by that debris.
  function openModal(opts) {
    var instance = $quepidModal.open(opts);
    var wrapper  = document.body.lastElementChild; // appended synchronously by open()
    instance.result.catch(function () {}); // avoid "possibly unhandled rejection" noise
    return { instance: instance, wrapper: wrapper };
  }

  function lastBackdrop() {
    var all = document.querySelectorAll('.modal-backdrop');
    return all.length ? all[all.length - 1] : null;
  }

  // A single $digest() does fully resolve open()'s compile-then-show $q
  // chain synchronously (verified: .modal-content is already populated and
  // a .modal-backdrop already exists right after one $digest()). The reason
  // callers still can't act on the modal immediately is BS5 itself: the
  // wrapper carries `.fade` (quepidModalSvc.js:84), so Modal.show() sets
  // `.show` and dispatches 'show.bs.modal' synchronously but keeps
  // `_isTransitioning` true — silently no-oping any hide() call — until the
  // real CSS transition completes and 'shown.bs.modal' fires. So: wait for
  // that event, not just a digest, before driving close()/dismiss().
  function waitUntilShown(wrapper, done, cb) {
    var timer = setTimeout(function () {
      done.fail('modal never fired shown.bs.modal within 2s');
    }, 2000);
    wrapper.addEventListener('shown.bs.modal', function onShown() {
      wrapper.removeEventListener('shown.bs.modal', onShown);
      clearTimeout(timer);
      $rootScope.$digest();
      cb();
    });
    $rootScope.$digest();
  }

  // teardownCore() (which removes `wrapper` from the DOM) runs synchronously
  // inside quepidModalSvc.js's own 'hidden.bs.modal' listener, registered
  // before this one — so by the time this fires, removal has already
  // happened and there's nothing left to poll for.
  function waitUntilRemoved(wrapper, done, cb) {
    var timer = setTimeout(function () {
      done.fail('modal never fired hidden.bs.modal within 2s');
    }, 2000);
    wrapper.addEventListener('hidden.bs.modal', function onHidden() {
      wrapper.removeEventListener('hidden.bs.modal', onHidden);
      clearTimeout(timer);
      $rootScope.$digest();
      cb();
    });
  }

  afterEach(function () {
    document.body.classList.remove('modal-open');
  });

  it('throws if neither template nor templateUrl is given', function () {
    expect(function () {
      $quepidModal.open({});
    }).toThrow();
  });

  it('throws if window.bootstrap.Modal is unavailable', function () {
    var realModal = window.bootstrap.Modal;
    delete window.bootstrap.Modal;
    try {
      expect(function () {
        $quepidModal.open({ template: '<div class="modal-header"></div>' });
      }).toThrow();
    } finally {
      window.bootstrap.Modal = realModal;
    }
  });

  it('compiles the template into .modal-content against the given scope', function (done) {
    scope.title = 'Hello Quepid';
    var opened = openModal({
      template: '<div class="modal-header">{{title}}</div>',
      scope:    scope
    });

    waitUntilShown(opened.wrapper, done, function () {
      var contentEl = opened.wrapper.querySelector('.modal-content');
      expect(contentEl.textContent).toContain('Hello Quepid');
      opened.instance.dismiss('cleanup');
      waitUntilRemoved(opened.wrapper, done, done);
    });
  });

  it('exposes $close/$dismiss on the modal scope', function (done) {
    var opened = openModal({ template: '<div class="modal-header"></div>' });

    waitUntilShown(opened.wrapper, done, function () {
      var contentEl  = opened.wrapper.querySelector('.modal-content');
      var modalScope = angular.element(contentEl).scope();
      expect(typeof modalScope.$close).toBe('function');
      expect(typeof modalScope.$dismiss).toBe('function');
      opened.instance.dismiss('cleanup');
      waitUntilRemoved(opened.wrapper, done, done);
    });
  });

  describe('close()', function () {
    // BS5's Modal.hide() silently no-ops while the show transition is still
    // in flight (see waitUntilShown above) — close()/dismiss() must not run
    // until the modal has actually finished showing, or the real BS5
    // teardown never happens and the wrapper/backdrop leak into the shared
    // karma document for every later test.
    it('resolves result with the given value', function (done) {
      var opened = openModal({ template: '<div class="modal-header"></div>' });

      waitUntilShown(opened.wrapper, done, function () {
        var resolvedWith;
        opened.instance.result.then(function (val) { resolvedWith = val; });

        opened.instance.close('the-value');

        waitUntilRemoved(opened.wrapper, done, function () {
          expect(resolvedWith).toBe('the-value');
          done();
        });
      });
    });

    it('removes the modal wrapper and backdrop from the DOM once BS5 finishes hiding it', function (done) {
      var opened = openModal({ template: '<div class="modal-header"></div>' });

      waitUntilShown(opened.wrapper, done, function () {
        var backdrop = lastBackdrop();
        expect(backdrop).not.toBeNull();

        opened.instance.close('done');

        waitUntilRemoved(opened.wrapper, done, function () {
          expect(document.body.contains(backdrop)).toBe(false);
          done();
        });
      });
    });

    it('is a no-op the second time it is called (settled guard)', function (done) {
      var opened = openModal({ template: '<div class="modal-header"></div>' });

      waitUntilShown(opened.wrapper, done, function () {
        var rejectSpy = jasmine.createSpy('reject');
        opened.instance.result.catch(rejectSpy);

        opened.instance.close('first');
        opened.instance.close('second');
        opened.instance.dismiss('third');

        waitUntilRemoved(opened.wrapper, done, function () {
          expect(rejectSpy).not.toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('dismiss()', function () {
    it('rejects result with the given reason', function (done) {
      var opened = openModal({ template: '<div class="modal-header"></div>' });

      waitUntilShown(opened.wrapper, done, function () {
        var rejectedWith;
        opened.instance.result.catch(function (reason) { rejectedWith = reason; });

        opened.instance.dismiss('cancelled');

        waitUntilRemoved(opened.wrapper, done, function () {
          expect(rejectedWith).toBe('cancelled');
          done();
        });
      });
    });
  });

  describe('abandon before shown', function () {
    it('never calls show() and tears down cleanly if dismissed before resolves settle', function () {
      var deferredResolve;
      var opened = openModal({
        template: '<div class="modal-header"></div>',
        resolve: {
          slow: function ($q) {
            var d = $q.defer();
            deferredResolve = d.resolve;
            return d.promise;
          }
        }
      });

      // Dismiss synchronously, before the resolve map above ever settles.
      opened.instance.dismiss('too soon');
      $rootScope.$digest();

      expect(document.body.contains(opened.wrapper)).toBe(true); // appended synchronously up-front...
      expect(opened.wrapper.classList.contains('show')).toBe(false); // ...but never shown

      deferredResolve('value');
      $rootScope.$digest();

      expect(document.body.contains(opened.wrapper)).toBe(false); // torn down once the resolve settles
    });
  });

  describe('nested modals', function () {
    it('bumps z-index on the inner modal and its backdrop, and restores modal-open after the inner closes', function (done) {
      var outer = openModal({ template: '<div class="modal-header">outer</div>' });

      waitUntilShown(outer.wrapper, done, function () {
        // Computed the same way quepidModalSvc.js computes it (line 243),
        // rather than asserting a hardcoded threshold — so this test
        // verifies the actual stacking *relationship* and can't be
        // satisfied by unrelated leftover `.modal.show` elements from other
        // spec files inflating the ambient count.
        var stackIdxBeforeInner = document.querySelectorAll('.modal.show').length;
        var inner = openModal({ template: '<div class="modal-header">inner</div>' });

        waitUntilShown(inner.wrapper, done, function () {
          var innerBackdrop   = lastBackdrop();
          var expectedZ        = 1050 + stackIdxBeforeInner * 20;
          var expectedBackdropZ = 1040 + stackIdxBeforeInner * 20;

          expect(innerBackdrop).not.toBeNull();
          expect(inner.wrapper.style.zIndex).toBe(String(expectedZ));
          if (innerBackdrop) {
            expect(innerBackdrop.style.zIndex).toBe(String(expectedBackdropZ));
          }

          // Close the inner modal only; BS5 unconditionally strips
          // modal-open from <body> on any hide, so the outer modal's
          // scroll lock must be re-applied once the inner tears down.
          inner.instance.close('inner-done');

          waitUntilRemoved(inner.wrapper, done, function () {
            expect(document.body.contains(outer.wrapper)).toBe(true);
            expect(document.body.classList.contains('modal-open')).toBe(true);

            outer.instance.dismiss('cleanup');
            waitUntilRemoved(outer.wrapper, done, done);
          });
        });
      });
    });
  });

});
