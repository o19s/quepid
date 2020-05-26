'use strict';

describe('Filter: scorerType', function () {

  // load the filter's module
  beforeEach(module('QuepidTest'));

  var mockScorers = [
      {
        'scorerId': 1,
        'name':     'Scorer 1 queryTest',
        'code':     'pass()',
        'owner_id': 1,
        'owned':    true,
        'queryTest':true,
        'communal': false,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      },
      {
        'scorerId': 2,
        'name':     'Scorer 2 queryTest',
        'code':     'pass()',
        'owner_id': 1,
        'owned':    true,
        'queryTest':true,
        'communal': false,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      },
      {
        'scorerId': 3,
        'name':     'Scorer 3 Communal Scorer',
        'code':     'pass()',
        'owner_id': null,
        'owned':    false,
        'queryTest':false,
        'communal': true,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      }
      ,
      {
        'scorerId': 4,
        'name':     'Scorer 4 Custom Scorer',
        'code':     'pass()',
        'owner_id': 2,
        'owned':    false,
        'queryTest':false,
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
    expect(results[0].name).toBe('Scorer 3 Communal Scorer');
  });

  it('filters to just the custom scorers"', function () {
    var results = scorerType(mockScorers, "custom");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Scorer 4 Custom Scorer');
  });

  it('filters to just the non tests"', function () {
    var results = scorerType(mockScorers, "not_test");
    expect(results.length).toBe(2);
  });

  it('filters to just the tests"', function () {
    var results = scorerType(mockScorers, "test");
    expect(results.length).toBe(2);
  });

  it('returns everything if you have a bogus filter"', function () {
    var results = scorerType(mockScorers, "fake-filter");
    expect(results.length).toBe(4);
  });

});
