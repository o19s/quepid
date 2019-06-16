'use strict';

describe('Service: signupSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var signupSvc;
  beforeEach(inject(function (_signupSvc_) {
    signupSvc = _signupSvc_;
  }));

  it('should exist', function () {
    expect(!!signupSvc).toBe(true);
  });

});

