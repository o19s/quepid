'use strict';

describe('Directive: quepidPopover', function () {

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

  it('creates a BS5 Popover instance on the element', function () {
    var element = compilePopover('<span quepid-popover="Some help text"></span>');
    var instance = window.bootstrap.Popover.getInstance(element[0]);
    expect(instance).not.toBeNull();
  });

  // Driven directly via instance.show()/hide() rather than a simulated
  // click — BS5's click-trigger handling depends on internal DOM/visibility
  // checks that are unrelated to what this directive is responsible for
  // (content wiring), and are exercised for real by the Playwright suite.
  // Safe to assert synchronously: the directive passes `animation: false`,
  // so show()/hide() never wait on a CSS transition (unlike quepidModalSvc's
  // `.fade` modals).
  it('shows the popover body text when shown (default trigger is click)', function () {
    var element = compilePopover('<span quepid-popover="Some help text"></span>');
    document.body.appendChild(element[0]);
    var instance = window.bootstrap.Popover.getInstance(element[0]);

    instance.show();

    var tipId = element.attr('aria-describedby');
    expect(tipId).toBeTruthy();
    var tip = document.getElementById(tipId);
    expect(tip.querySelector('.popover-body').textContent).toContain('Some help text');

    element[0].remove();
  });

  it('merges popover-title into .popover-header alongside the body', function () {
    scope.title = 'A Title';
    var element = compilePopover(
      '<span quepid-popover="Body text" popover-title="{{title}}"></span>'
    );
    document.body.appendChild(element[0]);
    var instance = window.bootstrap.Popover.getInstance(element[0]);

    instance.show();
    var tip = document.getElementById(element.attr('aria-describedby'));
    expect(tip.querySelector('.popover-header').textContent).toContain('A Title');
    expect(tip.querySelector('.popover-body').textContent).toContain('Body text');

    element[0].remove();
  });

  it('updates the popover body when the interpolated attribute changes', function () {
    // quepidPopover reads its content as a raw (interpolatable) attribute,
    // not a scope expression — {{helpText}} is required for $observe to
    // react to scope changes.
    scope.helpText = 'Original';
    var element = compilePopover('<span quepid-popover="{{helpText}}"></span>');
    document.body.appendChild(element[0]);
    var instance = window.bootstrap.Popover.getInstance(element[0]);

    instance.show();
    // BS5's setContent rebuilds the tip element in place (a fresh id each
    // time), so re-fetch by the current aria-describedby rather than
    // reusing an earlier node reference.
    var tipBefore = document.getElementById(element.attr('aria-describedby'));
    expect(tipBefore.querySelector('.popover-body').textContent).toContain('Original');

    scope.helpText = 'Updated';
    scope.$digest();
    var tipAfter = document.getElementById(element.attr('aria-describedby'));
    expect(tipAfter.querySelector('.popover-body').textContent).toContain('Updated');

    element[0].remove();
  });

  it('defaults to BS5 "click" when no popover-trigger is given', function () {
    var element = compilePopover('<span quepid-popover="x"></span>');
    var instance = window.bootstrap.Popover.getInstance(element[0]);
    expect(instance._config.trigger).toBe('click');
  });

  it('maps popover-trigger="mouseenter" to BS5 "hover focus"', function () {
    var element = compilePopover(
      '<span quepid-popover="x" popover-trigger="\'mouseenter\'"></span>'
    );
    var instance = window.bootstrap.Popover.getInstance(element[0]);
    expect(instance._config.trigger).toBe('hover focus');
  });

  it('maps popover-trigger="focus" to BS5 "focus"', function () {
    var element = compilePopover(
      '<span quepid-popover="x" popover-trigger="\'focus\'"></span>'
    );
    var instance = window.bootstrap.Popover.getInstance(element[0]);
    expect(instance._config.trigger).toBe('focus');
  });

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
    var element = compilePopover('<span quepid-popover="x"></span>');
    expect(window.bootstrap.Popover.getInstance(element[0])).not.toBeNull();

    scope.$destroy();

    expect(window.bootstrap.Popover.getInstance(element[0])).toBeNull();
  });

});
