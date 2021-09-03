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

  it('reports if communal scorers only is set', function () {
    configurationSvc.setCommunalScorersOnly(false);
    expect(configurationSvc.isCommunalScorersOnly()).toBe(false);
    configurationSvc.setCommunalScorersOnly(true);
    expect(configurationSvc.isCommunalScorersOnly()).toBe(true);
  });

});
