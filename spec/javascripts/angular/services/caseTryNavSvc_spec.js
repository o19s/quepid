'use strict';
/*global jasmine */

describe('Service: caseTryNavSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var locationMock = null;
  var caseTryNavSvc;

  beforeEach(function() {
    locationMock = {
      path: jasmine.createSpy(),
      search: jasmine.createSpy(),
      absUrl: jasmine.createSpy().and.returnValue('https://localhost:443/quepid/case/api/52?sort=default')

    };

    module(function($provide) {
      $provide.value('$location', locationMock);
    });

    /*jshint camelcase:false*/
    inject(function (_caseTryNavSvc_) {
      caseTryNavSvc = _caseTryNavSvc_;
    });
    /*jshint camelcase:true*/
  });

  it('navigates to new case/try', function () {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/1/');
  });

  it('navigates to new case', function() {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/1/');
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({caseNo: 4});
    expect(locationMock.path).toHaveBeenCalledWith('/case/4/try/1/');
  });

  it('navigates to new try', function() {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/1/');
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({tryNo: 4});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/4/');
  });

  it('navigates to new case when both specified', function () {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/1/');
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({caseNo: 4, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/4/try/1/');
  });

  it('navigates to new try when both specified', function () {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/1/');
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 2});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/2/');
  });

  it('doesnt save nav till confirmed', function() {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path).toHaveBeenCalledWith('/case/5/try/1/');
    expect(caseTryNavSvc.getCaseNo()).toBe(0);
    expect(caseTryNavSvc.getTryNo()).toBe(0);
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    expect(caseTryNavSvc.getCaseNo()).toBe(5);
    expect(caseTryNavSvc.getTryNo()).toBe(1);
  });

  it('calls location with trailing slash', function() {
    // due to an angular bug, we always need to have a trailing / to avoid duplicate route loading
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(locationMock.path.calls.argsFor(0)[0].slice(-1)).toEqual('/');
    expect(caseTryNavSvc.getCaseNo()).toBe(0);
    expect(caseTryNavSvc.getTryNo()).toBe(0);
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    expect(caseTryNavSvc.getCaseNo()).toBe(5);
    expect(caseTryNavSvc.getTryNo()).toBe(1);
  });

  it('allows completion off the bat', function() {
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    expect(caseTryNavSvc.getCaseNo()).toBe(5);
    expect(caseTryNavSvc.getTryNo()).toBe(1);
  });

  it('returns the quepid root url', function() {
    expect(caseTryNavSvc.getQuepidRootUrl()).toEqual('https://localhost:443/quepid');    
  });
});
