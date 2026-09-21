'use strict';

describe('Service: ConfigurationSvc', function () {

  // load the service's module
  beforeEach(module('UtilitiesModule'));

  // instantiate service
  var configurationSvc;
  beforeEach(function(){
    inject(function (_configurationSvc_) {
      configurationSvc = _configurationSvc_;
    });
  });

  it('exists', function () {
    expect(!!configurationSvc).toBe(true);
  });

  it('reports if communal scorers only is set', function () {
    configurationSvc.setCommunalScorersOnly(false);
    expect(configurationSvc.isCommunalScorersOnly()).toBe(false);
    configurationSvc.setCommunalScorersOnly(true);
    expect(configurationSvc.isCommunalScorersOnly()).toBe(true);
  });

  it('reports the caseNo seeded by the server', function () {
    configurationSvc.setCaseNo(5);
    expect(configurationSvc.getCaseNo()).toBe(5);
    configurationSvc.setCaseNo('7');
    expect(configurationSvc.getCaseNo()).toBe(7);
  });

  it('reports NaN for caseNo when nothing was seeded', function () {
    configurationSvc.setCaseNo(null);
    expect(configurationSvc.getCaseNo()).toBeNaN();
  });

  it('reports the tryNo seeded by the server', function () {
    configurationSvc.setTryNo(2);
    expect(configurationSvc.getTryNo()).toBe(2);
    configurationSvc.setTryNo('3');
    expect(configurationSvc.getTryNo()).toBe(3);
  });

  it('reports NaN for tryNo when nothing was seeded', function () {
    configurationSvc.setTryNo(null);
    expect(configurationSvc.getTryNo()).toBeNaN();
  });

});
