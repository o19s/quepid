'use strict';

describe('Filter: scorerType', function () {

  // load the filter's module
  beforeEach(module('QuepidTest'));

  var mockScorers = [
      {
        'scorerId': 1,
        'name':     'Scorer 1 Communal Scorer',
        'code':     'pass()',
        'owner_id': null,
        'owned':    false,
        'communal': true,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      }
      ,
      {
        'scorerId': 2,
        'name':     'Scorer 2 Custom Scorer',
        'code':     'pass()',
        'owner_id': 2,
        'owned':    false,
        'communal': false,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      }
    ];

  // initialize a new instance of the filter before each test
  var scorerType;
  beforeEach(inject(function ($filter) {
    scorerType = $filter('scorerType');
  }));

  it('filters to just the communal scorers"', function () {
    var results = scorerType(mockScorers, "communal");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Scorer 1 Communal Scorer');
  });

  it('filters to just the custom scorers"', function () {
    var results = scorerType(mockScorers, "custom");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Scorer 2 Custom Scorer');
  });

  it('returns everything if you have a bogus filter"', function () {
    var results = scorerType(mockScorers, "fake-filter");
    expect(results.length).toBe(2);
  });

});
