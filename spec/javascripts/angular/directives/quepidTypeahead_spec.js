'use strict';

describe('Directive: quepidTypeahead', function () {

  beforeEach(module('QuepidTest'));

  let $compile, scope, element, capturedConfig, realAutocompleter;

  beforeEach(inject(function (_$compile_, $rootScope) {
    $compile = _$compile_;
    scope = $rootScope.$new();

    // quepidTypeahead only talks to window.autocompleter through the config
    // object it passes in (fetch/render/onSelect); stubbing it out lets us
    // drive onSelect directly instead of simulating kraaden's real DOM/timer
    // driven dropdown.
    realAutocompleter = window.autocompleter;
    window.autocompleter = function (config) {
      capturedConfig = config;
      return { destroy: function () {} };
    };
  }));

  afterEach(function () {
    window.autocompleter = realAutocompleter;
  });

  function compileTypeahead() {
    element = $compile(
      '<input type="text" ng-model="selectedItem" ' +
        'quepid-typeahead="items" ' +
        'quepid-typeahead-label-field="name" ' +
        'quepid-typeahead-editable="false" />'
    )(scope);
    scope.$digest();
  }

  // Regression test: in object mode (quepid-typeahead-label-field set), the
  // $parsers hook used to unconditionally hand $commitViewValue back the
  // *old* $modelValue, so Angular's own "did the model actually change"
  // check in $$parseAndValidate always saw no change and never wrote the
  // selection to scope — onSelect()'s $setViewValue call was a silent no-op.
  it('writes the chosen item to ng-model on selection (object mode)', function () {
    scope.items = [ { id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' } ];
    compileTypeahead();

    expect(capturedConfig).toBeDefined();
    capturedConfig.onSelect({ id: 2, name: 'Beta' });
    scope.$digest();

    expect(scope.selectedItem).toEqual({ id: 2, name: 'Beta' });
  });

  it('does not let a later keystroke overwrite the selected object with a partial label', function () {
    scope.items = [ { id: 1, name: 'Alpha' } ];
    compileTypeahead();

    capturedConfig.onSelect({ id: 1, name: 'Alpha' });
    scope.$digest();
    expect(scope.selectedItem).toEqual({ id: 1, name: 'Alpha' });

    // Angular's native input directive calls $setViewValue on every
    // keystroke; in object mode this must keep freezing the model.
    element.val('Alp').triggerHandler('input');
    scope.$digest();

    expect(scope.selectedItem).toEqual({ id: 1, name: 'Alpha' });
  });

});
