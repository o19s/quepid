'use strict';

describe('Directive: quepidTooltip', function () {

  beforeEach(module('QuepidTest'));

  var $compile, $rootScope, scope;

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile   = _$compile_;
    $rootScope = _$rootScope_;
    scope      = $rootScope.$new();
  }));

  afterEach(function () {
    document.querySelectorAll('.tooltip').forEach(function (el) { el.remove(); });
  });

  function compileTooltip(html) {
    return window.compileDirective($compile, scope, html);
  }

  it('creates a BS5 Tooltip instance configured from the attrs', function () {
    var element = compileTooltip(
      '<a quepid-tooltip="Some tip" tooltip-placement="left"></a>'
    );
    var instance = window.bootstrap.Tooltip.getInstance(element[0]);
    expect(instance).not.toBeNull();
    expect(instance._config.title).toBe('Some tip');
    expect(instance._config.placement).toBe('left');
    expect(instance._config.html).toBe(false);
  });

  it('defaults placement to top and html to false', function () {
    var element = compileTooltip('<a quepid-tooltip="Some tip"></a>');
    var instance = window.bootstrap.Tooltip.getInstance(element[0]);
    expect(instance._config.placement).toBe('top');
    expect(instance._config.html).toBe(false);
  });

  it('enables html content when quepid-tooltip-html is present', function () {
    var element = compileTooltip(
      '<a quepid-tooltip="<b>bold</b>" quepid-tooltip-html></a>'
    );
    var instance = window.bootstrap.Tooltip.getInstance(element[0]);
    expect(instance._config.html).toBe(true);
  });

  it('updates tooltip content when the interpolated attribute changes', function () {
    // quepidTooltip reads its content as a raw (interpolatable) attribute,
    // not a scope expression — {{tip}} is required for $observe to react to
    // scope changes, a plain `quepid-tooltip="tip"` would only ever see the
    // literal string "tip".
    scope.tip = 'Original';
    var element = compileTooltip('<a quepid-tooltip="{{tip}}"></a>');
    var instance = window.bootstrap.Tooltip.getInstance(element[0]);
    spyOn(instance, 'setContent').and.callThrough();

    scope.tip = 'Updated';
    scope.$digest();

    expect(instance.setContent).toHaveBeenCalledWith({ '.tooltip-inner': 'Updated' });
  });

  it('disposes the BS5 instance on scope $destroy', function () {
    var element = compileTooltip('<a quepid-tooltip="x"></a>');
    expect(window.bootstrap.Tooltip.getInstance(element[0])).not.toBeNull();

    scope.$destroy();

    expect(window.bootstrap.Tooltip.getInstance(element[0])).toBeNull();
  });

  it('warns and skips wiring when window.bootstrap.Tooltip is unavailable', function () {
    var realTooltip = window.bootstrap.Tooltip;
    delete window.bootstrap.Tooltip;
    spyOn(console, 'warn');
    try {
      var element = compileTooltip('<a quepid-tooltip="x"></a>');
      expect(console.warn).toHaveBeenCalled();
      expect(element[0].hasAttribute('aria-describedby')).toBe(false);
    } finally {
      window.bootstrap.Tooltip = realTooltip;
    }
  });

});
