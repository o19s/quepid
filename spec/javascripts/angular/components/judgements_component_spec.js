'use strict';

/**
 * Unit specs for the judgements component (JudgementsCtrl).
 * Covers prompt() opening the modal and, on success, refreshing queries and setting flash.
 */
describe('Component: judgements (JudgementsCtrl)', function () {

  beforeEach(module('QuepidTest'));

  var $controller, $rootScope, $q;
  var ctrl;
  var mockUibModal, mockQueriesSvc, mockFlash;

  beforeEach(inject(function (_$controller_, _$rootScope_, _$q_) {
    $controller = _$controller_;
    $rootScope  = _$rootScope_;
    $q          = _$q_;
  }));

  beforeEach(function () {
    mockUibModal = jasmine.createSpyObj('$uibModal', ['open']);
    mockQueriesSvc = {
      reset:           jasmine.createSpy('reset'),
      bootstrapQueries: jasmine.createSpy('bootstrapQueries').and.returnValue($q.resolve()),
      searchAll:       jasmine.createSpy('searchAll')
    };
    mockFlash = { success: '' };

    ctrl = $controller('JudgementsCtrl', {
      $uibModal:  mockUibModal,
      flash:      mockFlash,
      queriesSvc: mockQueriesSvc
    });
  });

  it('should expose prompt', function () {
    expect(ctrl.prompt).toBeDefined();
    expect(typeof ctrl.prompt).toBe('function');
  });

  it('prompt() opens $uibModal with judgements modal template and resolve.acase', function () {
    var fakeModalInstance = { result: $q.defer().promise };
    mockUibModal.open.and.returnValue(fakeModalInstance);

    ctrl.acase = { caseNo: 1, caseName: 'Test Case' };
    ctrl.prompt();

    expect(mockUibModal.open).toHaveBeenCalled();
    var call = mockUibModal.open.calls.mostRecent();
    expect(call.args[0].templateUrl).toBe('judgements/_modal.html');
    expect(call.args[0].controller).toBe('JudgementsModalInstanceCtrl');
    expect(call.args[0].controllerAs).toBe('ctrl');
    expect(call.args[0].size).toBe('lg');
    expect(call.args[0].resolve.acase).toBeDefined();
    expect(typeof call.args[0].resolve.acase).toBe('function');
    expect(call.args[0].resolve.acase()).toBe(ctrl.acase);
  });

  it('when modal result resolves with bootstrapQueries true, resets queries, bootstraps, searchAll, and sets flash.success', function () {
    var deferred = $q.defer();
    mockUibModal.open.and.returnValue({ result: deferred.promise });
    ctrl.acase = { caseNo: 1 };

    ctrl.prompt();
    deferred.resolve(true);
    $rootScope.$digest();

    expect(mockQueriesSvc.reset).toHaveBeenCalled();
    expect(mockQueriesSvc.bootstrapQueries).toHaveBeenCalledWith(1);
    expect(mockQueriesSvc.searchAll).toHaveBeenCalled();
    expect(mockFlash.success).toBe('Ratings refreshed successfully!');
  });

  it('when modal result resolves with bootstrapQueries false, does not call reset/bootstrapQueries/searchAll', function () {
    var deferred = $q.defer();
    mockUibModal.open.and.returnValue({ result: deferred.promise });
    ctrl.acase = { caseNo: 1 };

    ctrl.prompt();
    deferred.resolve(false);
    $rootScope.$digest();

    expect(mockQueriesSvc.reset).not.toHaveBeenCalled();
    expect(mockQueriesSvc.bootstrapQueries).not.toHaveBeenCalled();
    expect(mockQueriesSvc.searchAll).not.toHaveBeenCalled();
  });
});
