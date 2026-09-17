'use strict';

// Text-mode `quepid-popover` (plain string content, no template) is no longer
// used anywhere in the app — the last call sites (searchResults.html "Close
// the results pane" icons) migrated to the Stimulus bs-popover controller.
// Only `quepid-popover-template` (ratings/matches popovers, still Angular)
// remains covered here.
describe('Directive: quepidPopoverTemplate', function () {

  beforeEach(module('QuepidTest'));

  var $compile, $rootScope, scope;

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile   = _$compile_;
    $rootScope = _$rootScope_;
    scope      = $rootScope.$new();
  }));

  afterEach(function () {
    document.querySelectorAll('.popover').forEach(function (el) { el.remove(); });
  });

  function compilePopover(html) {
    return window.compileDirective($compile, scope, html);
  }

  describe('popover-is-open two-way binding', function () {
    it('shows/hides the popover in response to the bound flag, and reflects user-driven hides back', function () {
      scope.ratings = { ratingsOn: false };
      var element = compilePopover(
        '<div quepid-popover-template="\'views/ratings/popover.html\'" ' +
             'popover-is-open="ratings.ratingsOn"></div>'
      );
      document.body.appendChild(element[0]);

      scope.ratings.ratingsOn = true;
      scope.$digest();

      var tipId = element.attr('aria-describedby');
      expect(tipId).toBeTruthy();
      expect(document.getElementById(tipId)).not.toBeNull();

      var instance = window.bootstrap.Popover.getInstance(element[0]);
      instance.hide();

      expect(scope.ratings.ratingsOn).toBe(false);
      element[0].remove();
    });

    // Every real call site pairing popover-is-open with the outsideClick
    // trigger also sets ng-click (searchResults.html, targetedSearchModal.html)
    // — quepidPopover.js deliberately skips wiring its own click handler in
    // that case (`trigger === 'outsideClick' && !attrs.ngClick`) to avoid a
    // double-toggle race with ng-click's own handler.
    it('does not wire its own click toggle when ng-click is present (matches every real call site)', function () {
      scope.ratings  = { ratingsOn: false };
      scope.onClick  = jasmine.createSpy('onClick');
      var element = compilePopover(
        '<div quepid-popover-template="\'views/ratings/popover.html\'" ' +
             'ng-click="onClick()" ' +
             'popover-trigger="outsideClick" ' +
             'popover-is-open="ratings.ratingsOn"></div>'
      );
      document.body.appendChild(element[0]);

      scope.ratings.ratingsOn = true;
      scope.$digest();
      expect(element.attr('aria-describedby')).toBeTruthy(); // opened via the is-open watcher

      // If quepidPopover ALSO wired its own outsideClick toggle here (the
      // regression this test guards against), this single click would
      // independently flip ratingsOn back to false via isOpenSet.
      element[0].click();

      expect(scope.onClick).toHaveBeenCalled();
      expect(scope.ratings.ratingsOn).toBe(true);

      element[0].remove();
    });
  });

  it('disposes the BS5 instance on scope $destroy', function () {
    var element = compilePopover(
      '<div quepid-popover-template="\'views/ratings/popover.html\'"></div>'
    );
    expect(window.bootstrap.Popover.getInstance(element[0])).not.toBeNull();

    scope.$destroy();

    expect(window.bootstrap.Popover.getInstance(element[0])).toBeNull();
  });

});
