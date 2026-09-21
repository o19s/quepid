'use strict';

describe('Controller: MainCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var scope, $q, $rootScope, $controller;
  var configurationSvcMock, caseTryNavSvcMock, caseSvcMock, settingsSvcMock;
  var queriesSvcMock, docCacheSvcMock, queryViewSvcMock, scorerSvcMock;
  var paneSvcMock, querySnapshotSvcMock;

  var acase = { caseNo: 5, lastTry: 2, tries: [] };

  beforeEach(inject(function (_$q_, _$rootScope_, _$controller_) {
    $q = _$q_;
    $rootScope = _$rootScope_;
    $controller = _$controller_;

    spyOn(window.quepidDom.flash, 'show');
    spyOn(window.quepidDom.flash, 'hide');

    configurationSvcMock = {
      getCaseNo: jasmine.createSpy().and.returnValue(5),
      getTryNo: jasmine.createSpy().and.returnValue(2)
    };

    caseTryNavSvcMock = {
      getCaseNo: jasmine.createSpy().and.returnValue(0),
      getTryNo: jasmine.createSpy().and.returnValue(0),
      navigationCompleted: jasmine.createSpy(),
      needToRedirectQuepidProtocol: jasmine.createSpy().and.returnValue(false),
      getQuepidProtocol: jasmine.createSpy().and.returnValue('https'),
      createSearchEndpointLink: jasmine.createSpy().and.returnValue('search_endpoints/1')
    };

    caseSvcMock = {
      get: jasmine.createSpy().and.returnValue($q.when(acase)),
      selectTheCase: jasmine.createSpy(),
      trackLastViewedAt: jasmine.createSpy(),
      fetchDropdownCases: jasmine.createSpy()
    };

    settingsSvcMock = {
      editableSettings: jasmine.createSpy().and.returnValue({ proxyRequests: true }),
      setCaseTries: jasmine.createSpy(),
      setCurrentTry: jasmine.createSpy(),
      isTrySelected: jasmine.createSpy().and.returnValue(true)
    };

    queriesSvcMock = {
      reset: jasmine.createSpy(),
      queries: [],
      querySearchPromiseReset: jasmine.createSpy(),
      changeSettings: jasmine.createSpy().and.returnValue($q.when()),
      searchAll: jasmine.createSpy().and.returnValue($q.when())
    };

    docCacheSvcMock = {
      empty: jasmine.createSpy(),
      invalidate: jasmine.createSpy(),
      update: jasmine.createSpy().and.returnValue($q.when())
    };

    queryViewSvcMock = {
      reset: jasmine.createSpy(),
      disableComparisons: jasmine.createSpy()
    };

    scorerSvcMock = { bootstrap: jasmine.createSpy() };
    paneSvcMock = { refreshElements: jasmine.createSpy() };
    querySnapshotSvcMock = { bootstrap: jasmine.createSpy().and.returnValue($q.when()) };

    scope = $rootScope.$new();
  }));

  function buildController() {
    return $controller('MainCtrl', {
      $scope: scope,
      configurationSvc: configurationSvcMock,
      caseTryNavSvc: caseTryNavSvcMock,
      caseSvc: caseSvcMock,
      settingsSvc: settingsSvcMock,
      queriesSvc: queriesSvcMock,
      docCacheSvc: docCacheSvcMock,
      queryViewSvc: queryViewSvcMock,
      scorerSvc: scorerSvcMock,
      paneSvc: paneSvcMock,
      querySnapshotSvc: querySnapshotSvcMock
    });
  }

  // caseNo/tryNo now come from configurationSvc (seeded server-side by Rails),
  // not $routeParams -- see docs/todo/angularjs_removal_inventory.md.
  it('bootstraps the case from configurationSvc\'s caseNo/tryNo', function () {
    buildController();
    $rootScope.$apply();

    expect(caseSvcMock.get).toHaveBeenCalledWith(5);
    expect(caseTryNavSvcMock.navigationCompleted).toHaveBeenCalledWith({ caseNo: 5, tryNo: 2 });
  });

  it('shows the "no cases" message and skips bootstrapping when caseNo is 0', function () {
    configurationSvcMock.getCaseNo.and.returnValue(0);

    buildController();
    $rootScope.$apply();

    expect(caseSvcMock.get).not.toHaveBeenCalled();
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith(
      'error', 'You don\'t have any Cases created in Quepid.  Click \'Create a Case\' from the Relevancy Cases dropdown to get started.'
    );
  });

  it('flashes a case-not-found error when caseSvc.get resolves undefined', function () {
    caseSvcMock.get.and.returnValue($q.when(undefined));

    buildController();
    $rootScope.$apply();

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith(
      'error', 'Could not retrieve case 5.   Confirm that the case has been shared with you via a team you are a member of!', 'search-error'
    );
  });

  it('flashes a try-not-found error when the resolved try is not selectable', function () {
    settingsSvcMock.isTrySelected.and.returnValue(false);

    buildController();
    $rootScope.$apply();

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith(
      'error', 'Could not load case 5 due to try number 2 not existing', 'search-error'
    );
  });

  it('flashes a mixed-content TLS error when the search engine needs a protocol switch', function () {
    settingsSvcMock.editableSettings.and.returnValue({
      proxyRequests: false,
      searchUrl: 'http://solr.example.com/select',
      searchEndpointId: 1
    });
    caseTryNavSvcMock.needToRedirectQuepidProtocol.and.returnValue(true);

    buildController();
    $rootScope.$apply();

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith(
      'error', jasmine.stringMatching(/^Blocked Request: mixed-content\./), 'search-error', { html: true }
    );
  });

});
