'use strict';

describe('Controller: SearchResultsCtrl', function () {
  beforeEach(module('QuepidTest'));

  var scope;
  var query;
  var queriesSvc;
  var $rootScope;
  var scorer = {};

  beforeEach(module(function($provide) {
    $provide.value('rateScaleSvc', {
      setScale: angular.noop
    });
    $provide.value('queryViewSvc', {
      isQueryToggled: angular.noop,
      toggleQuery: angular.noop
    });
    $provide.value('settingsSvc', {
      applicableSettings: function() { return {}; }
    });
  }));

  beforeEach(inject(function($controller, _$rootScope_, _queriesSvc_) {
    $rootScope = _$rootScope_;
    queriesSvc = _queriesSvc_;
    queriesSvc.showOnlyRated = true;

    query = {
      queryId: 42,
      queryText: 'star wars',
      diffs: null,
      docs: [],
      ratedDocs: [],
      version: function() { return 1; },
      effectiveScorer: function() { return scorer; },
      refreshRatedDocs: jasmine.createSpy('refreshRatedDocs')
    };
    scope = $rootScope.$new();
    scope.query = query;

    $controller('SearchResultsCtrl', {
      $scope: scope,
      $element: angular.element('<div></div>')
    });
  }));

  afterEach(function() {
    scope.$destroy();
  });

  it('refreshes rated documents when a matching rating changes in rated-only mode', function() {
    window.quepidStore.scoring.markRatingChanged(42);
    $rootScope.$digest();

    expect(query.refreshRatedDocs).toHaveBeenCalled();
  });
});
