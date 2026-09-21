'use strict';
/*global jasmine */

describe('Service: caseTryNavSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var locationMock = null;
  var windowMock = null;
  var caseTryNavSvc;

  beforeEach(function() {
    locationMock = {
      path: jasmine.createSpy(),
      search: jasmine.createSpy(),
      absUrl: jasmine.createSpy().and.returnValue('https://localhost:443/quepid/case/api/52?sort=default')

    };

    windowMock = {
      location: { assign: jasmine.createSpy(), href: '' }
    };

    module(function($provide) {
      $provide.value('$location', locationMock);
      $provide.value('$window', windowMock);
    });

    /*jshint camelcase:false*/
    inject(function (_caseTryNavSvc_) {
      caseTryNavSvc = _caseTryNavSvc_;
    });
    /*jshint camelcase:true*/
  });

  // navigateTo() is a real page navigation ($window.location.assign), not an
  // in-SPA route change -- see docs/todo/angularjs_removal_inventory.md.
  it('navigates to new case/try', function () {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(windowMock.location.assign).toHaveBeenCalledWith('https://localhost:443/quepid/case/5/try/1');
  });

  it('navigates to new case', function() {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({caseNo: 4});
    expect(windowMock.location.assign).toHaveBeenCalledWith('https://localhost:443/quepid/case/4/try/1');
  });

  it('navigates to new try', function() {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({tryNo: 4});
    expect(windowMock.location.assign).toHaveBeenCalledWith('https://localhost:443/quepid/case/5/try/4');
  });

  it('navigates to new case when both specified', function () {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({caseNo: 4, tryNo: 1});
    expect(windowMock.location.assign).toHaveBeenCalledWith('https://localhost:443/quepid/case/4/try/1');
  });

  it('navigates to new try when both specified', function () {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigationCompleted({caseNo: 5, tryNo: 1});
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 2});
    expect(windowMock.location.assign).toHaveBeenCalledWith('https://localhost:443/quepid/case/5/try/2');
  });

  it('carries the current sort/reverse query params onto the new URL', function() {
    locationMock.search.and.returnValue({ sort: 'name', reverse: 'true' });
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(windowMock.location.assign).toHaveBeenCalledWith('https://localhost:443/quepid/case/5/try/1?sort=name&reverse=true');
  });

  it('doesnt save nav till confirmed', function() {
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
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

  it('flashes an error and stays on the page on not found (no navigation)', function() {
    spyOn(window.quepidDom.flash, 'show');
    caseTryNavSvc.notFound();
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith('error', 'Unable to complete your request. Please try again.');
    expect(windowMock.location.assign).not.toHaveBeenCalled();
  });

  it('is not loading by default, and navigateTo() does not toggle it (real navigation replaces that UX)', function() {
    expect(caseTryNavSvc.isLoading()).toBe(false);
    caseTryNavSvc.navigateTo({caseNo: 5, tryNo: 1});
    expect(caseTryNavSvc.isLoading()).toBe(false);
  });
});
