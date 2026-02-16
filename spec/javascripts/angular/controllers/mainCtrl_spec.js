'use strict';

/**
 * Unit specs for MainCtrl bootstrap behavior.
 * MainCtrl bootstraps the case/try workspace: route params, case load, queries reset,
 * navigation notification, and flash messages when no cases exist.
 */
describe('Controller: MainCtrl', function () {

  beforeEach(module('QuepidTest'));

  var $controller, $rootScope, $q;
  var scope;
  var caseSvc, settingsSvc, querySnapshotSvc, caseTryNavSvc, queryViewSvc, queriesSvc;
  var docCacheSvc, diffResultsSvc, scorerSvc, paneSvc, flash;

  beforeEach(inject(function (
    _$controller_, _$rootScope_, _$q_,
    _caseSvc_, _settingsSvc_, _querySnapshotSvc_, _caseTryNavSvc_,
    _queryViewSvc_, _queriesSvc_, _docCacheSvc_, _diffResultsSvc_, _scorerSvc_,
    _paneSvc_, _flash_
  ) {
    $controller   = _$controller_;
    $rootScope    = _$rootScope_;
    $q            = _$q_;
    scope         = $rootScope.$new();

    caseSvc           = _caseSvc_;
    settingsSvc       = _settingsSvc_;
    querySnapshotSvc  = _querySnapshotSvc_;
    caseTryNavSvc     = _caseTryNavSvc_;
    queryViewSvc      = _queryViewSvc_;
    queriesSvc        = _queriesSvc_;
    docCacheSvc       = _docCacheSvc_;
    diffResultsSvc    = _diffResultsSvc_;
    scorerSvc         = _scorerSvc_;
    paneSvc           = _paneSvc_;
    flash             = _flash_;
  }));

  function createController(caseNo, tryNo) {
    var routeParams = { caseNo: String(caseNo), tryNo: tryNo !== undefined ? String(tryNo) : undefined };
    return $controller('MainCtrl', {
      $scope:       scope,
      $routeParams: routeParams,
      $rootScope:   $rootScope
    });
  }

  describe('bootstrap behavior', function () {

    it('calls caseTryNavSvc.navigationCompleted with caseNo and tryNo', function () {
      var navCompleted = spyOn(caseTryNavSvc, 'navigationCompleted');
      createController(1, 2);
      expect(navCompleted).toHaveBeenCalledWith({ caseNo: 1, tryNo: 2 });
    });

    it('when caseNo is 0, sets flash.error and does not bootstrap case', function () {
      var getSpy = spyOn(caseSvc, 'get').and.returnValue($q.resolve({}));
      createController(0, undefined);
      $rootScope.$digest();

      expect(flash.error).toContain("You don't have any Cases created");
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('when caseNo > 0, calls caseSvc.get with caseNo', function () {
      var acase = { caseNo: 1, lastTry: 1, caseName: 'Test', tries: [] };
      spyOn(caseSvc, 'get').and.returnValue($q.resolve(acase));
      spyOn(caseSvc, 'selectTheCase');
      spyOn(settingsSvc, 'setCaseTries');
      spyOn(settingsSvc, 'setCurrentTry');
      spyOn(settingsSvc, 'editableSettings').and.returnValue({
        proxyRequests: true,
        searchUrl: 'http://example.com/search',
        getTry: function () { return null; }
      });
      spyOn(settingsSvc, 'isTrySelected').and.returnValue(true);
      spyOn(caseTryNavSvc, 'needToRedirectQuepidProtocol').and.returnValue(false);
      spyOn(queriesSvc, 'querySearchPromiseReset');
      queriesSvc.queries = {};
      spyOn(docCacheSvc, 'update').and.returnValue($q.resolve());
      spyOn(queriesSvc, 'changeSettings').and.returnValue($q.resolve());
      spyOn(queriesSvc, 'searchAll').and.returnValue($q.resolve());
      spyOn(querySnapshotSvc, 'bootstrap').and.returnValue($q.resolve());
      spyOn(scorerSvc, 'bootstrap');
      spyOn(caseSvc, 'trackLastViewedAt');
      spyOn(caseSvc, 'fetchDropdownCases');
      spyOn(paneSvc, 'refreshElements');

      createController(1, 1);
      $rootScope.$digest();

      expect(caseSvc.get).toHaveBeenCalledWith(1);
    });
  });

  describe('init (case change)', function () {

    it('calls queriesSvc.reset when case changed from initial', function () {
      var queriesWithReset = { 0: { reset: jasmine.createSpy('reset') } };
      spyOn(caseTryNavSvc, 'getCaseNo').and.returnValue(99);
      spyOn(caseSvc, 'get').and.returnValue($q.resolve({}));
      spyOn(queriesSvc, 'reset');
      spyOn(queriesSvc, 'querySearchPromiseReset');
      queriesSvc.queries = queriesWithReset;
      spyOn(settingsSvc, 'editableSettings').and.returnValue({ getTry: function () { return null; } });
      spyOn(caseTryNavSvc, 'getTryNo').and.returnValue(1);
      spyOn(caseTryNavSvc, 'needToRedirectQuepidProtocol').and.returnValue(false);
      spyOn(settingsSvc, 'setCaseTries');
      spyOn(settingsSvc, 'setCurrentTry');
      spyOn(settingsSvc, 'isTrySelected').and.returnValue(true);
      spyOn(caseSvc, 'selectTheCase');
      spyOn(docCacheSvc, 'update').and.returnValue($q.resolve());
      spyOn(queriesSvc, 'changeSettings').and.returnValue($q.resolve());
      spyOn(queriesSvc, 'searchAll').and.returnValue($q.resolve());
      spyOn(scorerSvc, 'bootstrap');
      spyOn(paneSvc, 'refreshElements');
      spyOn(querySnapshotSvc, 'bootstrap').and.returnValue($q.resolve());
      spyOn(caseSvc, 'trackLastViewedAt');
      spyOn(caseSvc, 'fetchDropdownCases');

      createController(1, 1);
      $rootScope.$digest();

      expect(queriesSvc.reset).toHaveBeenCalled();
    });
  });
});
