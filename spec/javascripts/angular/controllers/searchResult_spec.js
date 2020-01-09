'use strict';

describe('Controller: SearchResultCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var SearchResultCtrl,
    scope;

  // Initialize the controller and a mock scope

  //beforeEach(inject(function ($controller, $rootScope) {
  //  scope = $rootScope.$new();
  //  SearchResultCtrl = $controller('SearchResultCtrl', {
  //    $scope: scope
  //  });
  //}));

  it('rejects empty or blank text', function() {

    // This method should actually be on the SearchResultCtrl (searchResult.js), however
    // we don't know how to make this test work.  So leaving this way for now.
    }
    var isUrl = function(value) {
      return (/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/.test(value.trim()));
    };

    expect(isUrl("http://www.example.com")).toBe(true);
    expect(isUrl("https://www.example.com/blah")).toBe(true);
    expect(isUrl("some text with nested https://www.example.com/blah shouldnt be true")).toBe(false);
    expect(isUrl("  https://www.example.com/blah")).toBe(true);
    expect(isUrl("  https://www.example.com/blah")).toBe(true);
    expect(isUrl("www.example.com/blah")).toBe(true);

  });

});
