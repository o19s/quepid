'use strict';

describe('Service: SecureRedirectSvc', function () {

  // load the service's module
  beforeEach(module('UtilitiesModule'));

  // instantiate service
  var secureRedirectSvc, windowMocker;
  beforeEach(function(){
    windowMocker = {
      location:{
        host: 'www.hostname.com',
        hostname: 'www.hostname.com'
      }
    };

    module(function($provide) {
      $provide.value('$window', windowMocker);
    });

    inject(function (_secureRedirectSvc_) {
      secureRedirectSvc = _secureRedirectSvc_;
    });
  });

  it('exists', function () {
    expect(!!secureRedirectSvc).toBe(true);
  });

  it('redirects to https', function () {
    secureRedirectSvc.redirectToSecure();
    expect(windowMocker.location).toEqual('https://www.hostname.com:443/secure');
  });
  it('redirects to https and appends path', function () {
    secureRedirectSvc.redirectToSecure('/pathname');
    expect(windowMocker.location).toEqual('https://www.hostname.com:443/secure/pathname');
  });
  it('redirects to http', function () {
    secureRedirectSvc.redirectToMain();
    expect(windowMocker.location).toEqual('http://www.hostname.com');
  });
  it('redirects to http and appends path', function () {
    secureRedirectSvc.redirectToMain('/pathname');
    expect(windowMocker.location).toEqual('http://www.hostname.com/pathname');
  });
});
