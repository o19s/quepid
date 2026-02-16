'use strict';

/**
 * Unit specs for the export_case directive/controller (ExportCaseCtrl).
 * Covers theCase resolution (scope vs caseSvc), prompt() opening the modal,
 * and exportCase() for at least one format (e.g. general).
 */
describe('Controller: ExportCaseCtrl', function () {

  beforeEach(module('QuepidTest'));

  var $controller, $rootScope, $q, $log;
  var scope;
  var ctrl;
  var mockUibModal, mockCaseSvc, mockCaseCSVSvc, mockQueriesSvc, mockQuerySnapshotSvc;

  beforeEach(inject(function (_$controller_, _$rootScope_, _$q_, _$log_) {
    $controller = _$controller_;
    $rootScope  = _$rootScope_;
    $q          = _$q_;
    $log        = _$log_;
  }));

  beforeEach(function () {
    scope = $rootScope.$new();
    mockUibModal = jasmine.createSpyObj('$uibModal', ['open']);
    mockCaseSvc = {
      getSelectedCase: jasmine.createSpy('getSelectedCase').and.returnValue({ caseNo: 1, caseName: 'Selected' }),
      get:             jasmine.createSpy('get').and.returnValue($q.resolve({ caseNo: 1, caseName: 'Fetched', tries: [] }))
    };
    mockCaseCSVSvc = {
      stringify:              jasmine.createSpy('stringify').and.returnValue('csv,data'),
      formatDownloadFileName: jasmine.createSpy('formatDownloadFileName').and.returnValue('Fetched_general.csv')
    };
    mockQueriesSvc = { queries: [] };
    mockQuerySnapshotSvc = { get: jasmine.createSpy('get').and.returnValue($q.resolve()), snapshots: {} };
  });

  it('uses theCase from $scope when $scope.theCase is set', function () {
    scope.theCase = { caseNo: 2, caseName: 'From Scope' };
    ctrl = $controller('ExportCaseCtrl', {
      $uibModal:            mockUibModal,
      $scope:               scope,
      $log:                 $log,
      caseSvc:              mockCaseSvc,
      caseCSVSvc:           mockCaseCSVSvc,
      queriesSvc:           mockQueriesSvc,
      querySnapshotSvc:     mockQuerySnapshotSvc
    });
    expect(ctrl.theCase).toEqual({ caseNo: 2, caseName: 'From Scope' });
  });

  it('uses caseSvc.getSelectedCase() when $scope.theCase is not set', function () {
    ctrl = $controller('ExportCaseCtrl', {
      $uibModal:            mockUibModal,
      $scope:               scope,
      $log:                 $log,
      caseSvc:              mockCaseSvc,
      caseCSVSvc:           mockCaseCSVSvc,
      queriesSvc:           mockQueriesSvc,
      querySnapshotSvc:     mockQuerySnapshotSvc
    });
    expect(ctrl.theCase).toEqual({ caseNo: 1, caseName: 'Selected' });
    expect(mockCaseSvc.getSelectedCase).toHaveBeenCalled();
  });

  it('prompt() opens $uibModal with export_case modal and resolve.theCase and supportsDetailedExport', function () {
    mockUibModal.open.and.returnValue({ result: $q.defer().promise });
    ctrl = $controller('ExportCaseCtrl', {
      $uibModal:            mockUibModal,
      $scope:               scope,
      $log:                 $log,
      caseSvc:              mockCaseSvc,
      caseCSVSvc:           mockCaseCSVSvc,
      queriesSvc:           mockQueriesSvc,
      querySnapshotSvc:     mockQuerySnapshotSvc
    });

    ctrl.prompt();

    expect(mockUibModal.open).toHaveBeenCalled();
    var call = mockUibModal.open.calls.mostRecent();
    expect(call.args[0].templateUrl).toBe('export_case/_modal.html');
    expect(call.args[0].controller).toBe('ExportCaseModalInstanceCtrl');
    expect(call.args[0].resolve.theCase).toBeDefined();
    expect(typeof call.args[0].resolve.theCase).toBe('function');
    expect(call.args[0].resolve.theCase()).toBe(ctrl.theCase);
    expect(call.args[0].resolve.supportsDetailedExport).toBeDefined();
  });

  it('exportCase({ which: "general" }) fetches case, stringifies CSV, and triggers download via saveAs', function () {
    var saveAsCalled = false;
    var saveAsBlob = null;
    var saveAsName = null;
    window.saveAs = function (blob, name) {
      saveAsCalled = true;
      saveAsBlob = blob;
      saveAsName = name;
    };

    ctrl = $controller('ExportCaseCtrl', {
      $uibModal:            mockUibModal,
      $scope:               scope,
      $log:                 $log,
      caseSvc:              mockCaseSvc,
      caseCSVSvc:           mockCaseCSVSvc,
      queriesSvc:           mockQueriesSvc,
      querySnapshotSvc:     mockQuerySnapshotSvc
    });
    ctrl.theCase = { caseNo: 1, caseName: 'Test' };

    ctrl.exportCase({ which: 'general' });
    $rootScope.$digest();

    expect(mockCaseSvc.get).toHaveBeenCalledWith(1, false);
    $rootScope.$digest();
    expect(mockCaseCSVSvc.stringify).toHaveBeenCalledWith(
      { caseNo: 1, caseName: 'Fetched', tries: [] },
      mockQueriesSvc.queries,
      true
    );
    expect(mockCaseCSVSvc.formatDownloadFileName).toHaveBeenCalledWith('Fetched_general.csv');
    expect(saveAsCalled).toBe(true);
    expect(saveAsName).toBe('Fetched_general.csv');
  });
});
