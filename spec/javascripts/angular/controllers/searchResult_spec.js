'use strict';

describe('Controller: SearchResultCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var SearchResultCtrl,
    scope;

  var mockDoc = {
    subSnippets: function(hlPre, hlPost) {
      return [];
    }
  };

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    scope.doc = mockDoc;
    SearchResultCtrl = $controller('SearchResultCtrl', {
      $scope: scope
    });

  }));

  describe('Initial state', function () {
    it('instantiates the controller properly', function () {
      expect(SearchResultCtrl).not.toBeUndefined();
    });
  });

  it('Check url paths', function () {
    expect(scope.isUrl("http://amazon.ca")).toBe(true);
    expect(scope.isUrl("https://amazon.ca")).toBe(true);
    expect(scope.isUrl("httpx://amazon.ca")).toBe(false);
    expect(scope.isUrl(" http://amazon.ca")).toBe(true);
    expect(scope.isUrl(" https://amazon.ca")).toBe(true);
  });
});
