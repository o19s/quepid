'use strict';

describe('Directive: countUp', function () {

  beforeEach(module('QuepidTest'));

  var $compile, $rootScope, scope;

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile   = _$compile_;
    $rootScope = _$rootScope_;
    scope      = $rootScope.$new();
    jasmine.clock().install();
  }));

  afterEach(function () {
    jasmine.clock().uninstall();
  });

  function compileCountUp(html) {
    return window.compileDirective($compile, scope, html);
  }

  it('renders the initial value with no animation', function () {
    scope.numFound = 23;
    var element = compileCountUp('<span count-up="numFound"></span>');
    expect(element[0].textContent).toBe('23');
  });

  it('steps from the previous value up to a new one on change', function () {
    scope.numFound = 0;
    var element = compileCountUp('<span count-up="numFound"></span>');

    scope.numFound = 10;
    scope.$digest();

    jasmine.clock().tick(100);
    expect(element[0].textContent).toBe('2');

    jasmine.clock().tick(400);
    expect(element[0].textContent).toBe('10');
  });

  it('stops its animation on scope $destroy', function () {
    scope.numFound = 0;
    var element = compileCountUp('<span count-up="numFound"></span>');

    scope.numFound = 10;
    scope.$digest();
    jasmine.clock().tick(100);
    expect(element[0].textContent).toBe('2');

    scope.$destroy();
    jasmine.clock().tick(400);
    expect(element[0].textContent).toBe('2');
  });
});
