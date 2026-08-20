'use strict';

describe('Directive: quepidSortable', function () {

  beforeEach(module('QuepidTest'));

  var $compile, scope;

  beforeEach(inject(function (_$compile_, $rootScope) {
    $compile = _$compile_;
    scope    = $rootScope.$new();
    spyOn(window.Sortable, 'create').and.callThrough();
  }));

  function compileSortable(optsExpr) {
    return window.compileDirective($compile, scope,
      '<ul quepid-sortable="' + optsExpr + '">' +
        '<li>one</li><li>two</li><li class="unsortable">three</li>' +
      '</ul>'
    );
  }

  function createdConfig() {
    return window.Sortable.create.calls.mostRecent().args[1];
  }

  it('creates a SortableJS instance on the element with the .unsortable filter', function () {
    scope.opts = {};
    var element = compileSortable('opts');

    expect(window.Sortable.create).toHaveBeenCalled();
    expect(window.Sortable.create.calls.mostRecent().args[0]).toBe(element[0]);
    expect(createdConfig().filter).toBe('.unsortable');
    expect(createdConfig().preventOnFilter).toBe(false);
  });

  it('the filter selector actually matches the .unsortable item in this list', function () {
    // createdConfig().filter is only compared against a literal string
    // elsewhere in this file; a typo (e.g. '.un-sortable') would still
    // equal itself. Matching it against the real markup catches drift
    // between this directive's filter option and the '.unsortable' class
    // callers (e.g. queries.html) actually rely on.
    scope.opts = {};
    var element = compileSortable('opts');

    expect(element[0].querySelector(createdConfig().filter)).not.toBeNull();
  });

  it('honors an initially disabled option', function () {
    scope.opts = { disabled: true };
    compileSortable('opts');

    expect(createdConfig().disabled).toBe(true);
  });

  it('calls opts.start (inside a digest) and hides open tooltips within the list on drag start', function () {
    scope.opts = { start: jasmine.createSpy('start') };
    var element = compileSortable('opts');
    document.body.appendChild(element[0]);

    var tooltipEl = document.createElement('span');
    tooltipEl.setAttribute('quepid-tooltip', 'x');
    element[0].firstChild.appendChild(tooltipEl);
    var tooltip = new window.bootstrap.Tooltip(tooltipEl, { title: 'x' });
    spyOn(tooltip, 'hide');
    spyOn(window.bootstrap.Tooltip, 'getInstance').and.returnValue(tooltip);

    createdConfig().onStart();

    expect(tooltip.hide).toHaveBeenCalled();
    expect(scope.opts.start).toHaveBeenCalled();

    tooltip.dispose();
    element[0].remove();
  });

  it('calls opts.stop with (oldIndex, newIndex) on drag end', function () {
    scope.opts = { stop: jasmine.createSpy('stop') };
    compileSortable('opts');

    createdConfig().onEnd({ oldIndex: 0, newIndex: 2 });

    expect(scope.opts.stop).toHaveBeenCalledWith(0, 2);
  });

  it('propagates changes to opts.disabled to the live Sortable instance', function () {
    scope.opts = { disabled: false };
    compileSortable('opts');

    var instance = window.Sortable.create.calls.mostRecent().returnValue;
    spyOn(instance, 'option').and.callThrough();

    scope.opts.disabled = true;
    scope.$digest();

    expect(instance.option).toHaveBeenCalledWith('disabled', true);
  });

  it('destroys the Sortable instance on scope $destroy', function () {
    scope.opts = {};
    compileSortable('opts');

    var instance = window.Sortable.create.calls.mostRecent().returnValue;
    spyOn(instance, 'destroy');

    scope.$destroy();

    expect(instance.destroy).toHaveBeenCalled();
  });

  it('warns and skips wiring when window.Sortable is unavailable', function () {
    var realSortable = window.Sortable;
    window.Sortable = undefined;
    spyOn(console, 'warn');
    try {
      scope.opts = {};
      compileSortable('opts');
      expect(console.warn).toHaveBeenCalled();
    } finally {
      window.Sortable = realSortable;
    }
  });

});
