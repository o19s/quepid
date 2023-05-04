'use strict';

describe('Controller: SettingsCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  let SettingsCtrl = null;
  let scope = null;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    SettingsCtrl = $controller('SettingsCtrl', {
      $scope: scope
    });
    // mock settingsSvc
    // mock queriessvc w/ spy
  }));

  it('placeholder till we actually have a test', function () {
    expect(true).toBe(true);
  });

});
