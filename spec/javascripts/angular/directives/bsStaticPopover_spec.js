'use strict';

describe('Directive: bsStaticPopover', function () {

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

  function compileStaticPopover(html) {
    return window.compileDirective($compile, scope, html);
  }

  it('creates a hover popover from data-bs-content', function () {
    var element = compileStaticPopover(
      '<i bs-static-popover data-bs-placement="right" data-bs-content="Help text"></i>'
    );
    var instance = window.bootstrap.Popover.getInstance(element[0]);
    expect(instance).not.toBeNull();
    expect(instance._config.placement).toBe('right');
    expect(instance._config.trigger).toBe('hover focus');
  });

  it('disposes on scope $destroy', function () {
    var element = compileStaticPopover(
      '<i bs-static-popover data-bs-content="x"></i>'
    );
    expect(window.bootstrap.Popover.getInstance(element[0])).not.toBeNull();
    scope.$destroy();
    expect(window.bootstrap.Popover.getInstance(element[0])).toBeNull();
  });
});
