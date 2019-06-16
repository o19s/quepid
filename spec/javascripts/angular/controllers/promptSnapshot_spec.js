'use strict';

describe('Controller: PromptSnapshotCtrl', function () {

  beforeEach(module('QuepidTest'));

  var Ctrl, scope, modalInstance, $httpBackend;
  var querySnapshotSvc, settingsSvc, docResolverSvc;

  var basicExplain1 = {
    match:        true,
    value:        1.5,
    description: 'weight(text:law in 1234)',
    details:      []
  };
  var rawExpl = angular.toJson(basicExplain1);

  var addedSnapResp = {
    'snapshots': {
      '5': {
        id: '5',
        name: 'myname',
        time: '1392318891',
        docs: {
          '0': [{id: '1', explain: rawExpl},{id: '4', explain: rawExpl}, {id: '7', explain: rawExpl}],
          '1': [{id: 'cat', explain: rawExpl}, {id: 'banana', explain: rawExpl}, {id: 'doc', explain: rawExpl}],
        }
      }
    }
  };

  beforeEach(function() {
    module(function($provide) {
      docResolverSvc = new MockDocResolverSvc();
      $provide.value('docResolverSvc', docResolverSvc);
      settingsSvc = new MockSettingsSvc();
      $provide.value('settingsSvc', settingsSvc);
    });
    /* jshint camelcase: false */
    inject(function ($controller, $rootScope, _$uibModal_, _querySnapshotSvc_, $injector) {
      scope             = $rootScope.$new();
      $httpBackend      = $injector.get('$httpBackend');
      querySnapshotSvc  = _querySnapshotSvc_;

      modalInstance = _$uibModal_.open({
        templateUrl: 'views/snapshotModal.html'
      });

      spyOn(modalInstance, "close");

      Ctrl = $controller('PromptSnapshotCtrl', {
        $scope:         scope,
        $uibModalInstance: modalInstance,
      });

      $httpBackend.expectGET('/api/cases/2/snapshots').respond(200, {'snapshots': {}});

      querySnapshotSvc.bootstrap(2);
      $httpBackend.flush();
    });
  });

  describe('Initial state', function () {
    it('instantiates the controller properly', function () {
      expect(Ctrl).not.toBeUndefined();
    });
  });

  describe('Ok', function () {
    it('it sets the prompt values properly and closes the modal only after success', function () {
      $httpBackend.expectPOST('/api/cases/2/snapshots', {"snapshot":{"name":"","docs":{}}})
      .respond(200, addedSnapResp);

      scope.ok();
      expect(modalInstance.close).not.toHaveBeenCalled();
      expect(scope.snapPrompt.inProgress).toBe(true);
      expect(scope.snapPrompt.error).toBe(null);
      $httpBackend.flush();
      expect(modalInstance.close).toHaveBeenCalled();
      expect(scope.snapPrompt.inProgress).toBe(false);
    });
  });

});
