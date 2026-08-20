'use strict';

describe('Directive: quepidCollapse', function () {

  beforeEach(module('QuepidTest'));

  var $compile, $timeout, scope;

  beforeEach(inject(function (_$compile_, _$timeout_, $rootScope) {
    $compile = _$compile_;
    $timeout = _$timeout_;
    scope    = $rootScope.$new();
  }));

  function compileCollapse(expr) {
    return window.compileDirective($compile, scope, '<div quepid-collapse="' + expr + '"></div>');
  }

  it('settles collapsed (no animation) when the initial value is truthy', function () {
    scope.hide = true;
    var element = compileCollapse('hide');

    expect(element.hasClass('collapse')).toBe(true);
    expect(element.hasClass('show')).toBe(false);
    expect(element.hasClass('collapsing')).toBe(false);
    expect(element.attr('aria-expanded')).toBe('false');
    expect(element.attr('aria-hidden')).toBe('true');
  });

  it('settles expanded (no animation) when the initial value is falsy', function () {
    scope.hide = false;
    var element = compileCollapse('hide');

    expect(element.hasClass('collapse')).toBe(true);
    expect(element.hasClass('show')).toBe(true);
    expect(element.attr('aria-expanded')).toBe('true');
    expect(element.attr('aria-hidden')).toBe('false');
  });

  it('animates through .collapsing before settling collapsed on a later change', function () {
    scope.hide = false;
    var element = compileCollapse('hide');

    scope.hide = true;
    scope.$digest();

    expect(element.hasClass('collapsing')).toBe(true);
    expect(element.hasClass('collapse')).toBe(false);

    $timeout.flush(350);

    expect(element.hasClass('collapsing')).toBe(false);
    expect(element.hasClass('collapse')).toBe(true);
    expect(element.hasClass('show')).toBe(false);
    expect(element.attr('aria-expanded')).toBe('false');
  });

  it('animates through .collapsing before settling expanded on a later change', function () {
    scope.hide = true;
    var element = compileCollapse('hide');

    scope.hide = false;
    scope.$digest();

    expect(element.hasClass('collapsing')).toBe(true);

    $timeout.flush(350);

    expect(element.hasClass('collapsing')).toBe(false);
    expect(element.hasClass('collapse')).toBe(true);
    expect(element.hasClass('show')).toBe(true);
    expect(element.attr('aria-expanded')).toBe('true');
  });

  it('cancels a pending transition timer on scope $destroy', function () {
    scope.hide = false;
    compileCollapse('hide');

    scope.hide = true;
    scope.$digest();

    scope.$destroy();

    expect(function () { $timeout.verifyNoPendingTasks(); }).not.toThrow();
  });

});
