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
      $scope:   scope,
      $element: angular.element('<div></div>')
    });

  }));

  describe('Initial state', function () {
    it('instantiates the controller properly', function () {
      expect(SearchResultCtrl).not.toBeUndefined();
    });
  });

});
