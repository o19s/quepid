'use strict';

describe('Filter: ratingBgStyle', function () {

  // load the filter's module
  beforeEach(module('QuepidTest'));

  // initialize a new instance of the filter before each test
  var ratingBgStyle;
  beforeEach(inject(function ($filter) {
    ratingBgStyle = $filter('ratingBgStyle');
  }));

  it('1-10 should generate a bg color"', function () {

    for (var i = 1; i <= 10; ++i) {
      var text = i.toString();
      expect(ratingBgStyle(text)['background-color']).toBeDefined();
    }
  });

});
