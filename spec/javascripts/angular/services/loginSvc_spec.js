'use strict';

describe('Service: loginSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var loginSvc, userSvc, secureMocker, $httpBackend, $location, windowMocker = null;
  beforeEach(function() {
    secureMocker = {
      redirectToMain: jasmine.createSpy()
    };

    module(function($provide) {
      $provide.value('secureRedirectSvc', secureMocker);
    });

    inject(function (_loginSvc_, _userSvc_, _$httpBackend_) {
      loginSvc = _loginSvc_;
      userSvc = _userSvc_
      $httpBackend = _$httpBackend_;
    });
  });

  afterEach(function(){
    $httpBackend.verifyNoOutstandingExpectation;
    $httpBackend.verifyNoOutstandingRequest;
  });

  it('exists', function () {
    expect(!!loginSvc).toBe(true);
  });

  it('uses the backend to post login ', function() {
    $httpBackend.expectPOST('/users/login', {email:'user@example.com', password:'pass'}).respond({email:'user@example.com'});
    loginSvc.login('user@example.com','pass');
    $httpBackend.flush();
  });

  it('redirects to http address', function () {
    $httpBackend.expectPOST('/users/login', {email:'user@example.com', password:'pass'}).respond({email:'user@example.com'});
    loginSvc.login('user@example.com','pass');
    $httpBackend.flush();
    expect(secureMocker.redirectToMain).toHaveBeenCalled();
  });
});
