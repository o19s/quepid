'use strict';

describe('Service: ConfigurationSvc', function () {

  // load the service's module
  beforeEach(module('UtilitiesModule'));

  // instantiate service
  var configurationSvc, windowMocker;
  beforeEach(function(){
    inject(function (_configurationSvc_) {
      configurationSvc = _configurationSvc_;
    });
  });

  it('exists', function () {
    expect(!!configurationSvc).toBe(true);
  });

  it('reports if signup is enabled', function () {
    configurationSvc.setSignupEnabled(false);
    expect(configurationSvc.isSignupEnabled()).toBe(false);
    configurationSvc.setSignupEnabled(true);
    expect(configurationSvc.isSignupEnabled()).toBe(true);
  });

  it('reports if terms and conditions url was set', function () {
    configurationSvc.setTermsAndConditionsUrl('https://quepid.com/agreement');
    expect(configurationSvc.hasTermsAndConditions()).toBe(true);
    expect(configurationSvc.getTermsAndConditionsUrl()).toEqual('https://quepid.com/agreement');
  });

  it('reports it doesnt have terms and conditions if not set, or blank', function () {

    expect(configurationSvc.hasTermsAndConditions()).toBe(false);
    configurationSvc.setTermsAndConditionsUrl('');
    expect(configurationSvc.hasTermsAndConditions()).toBe(false);

  });

  it('reports if communcal scorers only is set', function () {
    configurationSvc.setCommunalScorersOnly(false);
    expect(configurationSvc.isCommunalScorersOnly()).toBe(false);
    configurationSvc.setCommunalScorersOnly(true);
    expect(configurationSvc.isCommunalScorersOnly()).toBe(true);
  });

});
