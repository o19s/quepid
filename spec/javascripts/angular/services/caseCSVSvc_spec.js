'use strict';

describe('Service: caseCSVSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var caseCSVSvc;

  beforeEach(function() {
    inject(function (_caseCSVSvc_) {
      caseCSVSvc = _caseCSVSvc_;
    });
  });

  // `stringify` (the "general" export format) moved to
  // app/javascript/utils/case_csv.js (buildGeneralCaseCsv) when the
  // AngularJS <export-case> component was replaced by the Stimulus
  // `export-case-core` modal — its escaping-edge-case coverage below moved
  // with it to test/javascript/utils/case_csv.test.js.
  describe('fixObjectKeys', function () {
    it('strips leading and trailing spaces in the keys', function () {

      var mockResultFromUploadingCSVWithSpaces = [
        {
        "Query Text ": "star wars",
        " Movie Title ": "Star Wars",
        "MovieRating ": "PG"
        }
      ];

      const result = caseCSVSvc.fixObjectKeys(mockResultFromUploadingCSVWithSpaces);

      expect(result).toEqual([{
        "Query Text": "star wars",
        "Movie Title": "Star Wars",
        "MovieRating": "PG"
      }]);
    });
  });
});

// Separate top-level describe (not nested in the one above) so its own
// beforeEach controls injection: it deliberately never injects
// `caseCSVSvc` itself, to prove that the `export-case:detailed` bridge in
// caseCSVSvc.js's `.run()` block attaches on app bootstrap regardless of
// whether anything in the dependency graph references caseCSVSvc directly.
// The first test below is what actually guards that: deleting the `.run()`
// block makes it (and only it) fail, since without eager instantiation there
// is no listener to call saveAs at all. The second test covers a different,
// unrelated concern (the case-mismatch guard inside the listener) and would
// pass just as well with no listener attached — it's here for completeness,
// not as a `.run()` regression guard.
describe('caseCSVSvc export-case:detailed bridge', function () {
  var caseSvc, queriesSvc;

  beforeEach(module('QuepidTest'));

  beforeEach(function() {
    inject(function (_caseSvc_, _queriesSvc_) {
      caseSvc = _caseSvc_;
      queriesSvc = _queriesSvc_;
    });
  });

  function mockQuery() {
    return {
      queryText: 'dog',
      docs: [],
      fieldSpec: function() {
        return { fields: [], id: 'id', title: 'title' };
      }
    };
  }

  it('attaches its listener eagerly via .run() and downloads a detailed-export CSV when the event matches the currently selected case', function () {
    queriesSvc.queries = { 1: mockQuery() };
    caseSvc.selectTheCase({
      caseNo: 42,
      caseName: 'Eager Bridge Case',
      lastScore: { case_id: 42 },
      teamNames: function() { return 'Team'; }
    });
    spyOn(window, 'saveAs');

    document.dispatchEvent(new CustomEvent('export-case:detailed', { detail: { caseId: 42 } }));

    expect(window.saveAs).toHaveBeenCalled();
    var args = window.saveAs.calls.mostRecent().args;
    expect(args[0] instanceof Blob).toBe(true);
    expect(args[1]).toBe('Eager_Bridge_Case_detailed.csv');
  });

  it('does nothing when the event\'s caseId does not match the currently selected case', function () {
    queriesSvc.queries = { 1: mockQuery() };
    caseSvc.selectTheCase({
      caseNo: 42,
      caseName: 'Eager Bridge Case',
      lastScore: { case_id: 42 },
      teamNames: function() { return 'Team'; }
    });
    spyOn(window, 'saveAs');

    document.dispatchEvent(new CustomEvent('export-case:detailed', { detail: { caseId: 999 } }));

    expect(window.saveAs).not.toHaveBeenCalled();
  });
});
