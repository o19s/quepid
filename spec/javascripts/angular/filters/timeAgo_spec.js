'use strict';

describe('Filter: timeAgo', function () {

  beforeEach(module('QuepidTest'));

  var timeAgo;

  beforeEach(inject(function ($filter) {
    timeAgo = $filter('timeAgo');
  }));

  it('returns empty string for missing input', function () {
    expect(timeAgo()).toBe('');
    expect(timeAgo(null)).toBe('');
  });

  it('formats a recent timestamp as relative time', function () {
    var oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(oneMinuteAgo)).toMatch(/minute/);
  });
});
