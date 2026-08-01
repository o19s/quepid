'use strict';

describe('Controller: QueryparamsCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var QueryparamsCtrl,
    scope,
    testTry;
  
  var $httpBackend;


  // Initialize the controller and a mock scope
  beforeEach(inject(function ($injector, $controller, $rootScope, TryFactory) {
    scope = $rootScope.$new();
    
    $httpBackend = $injector.get('$httpBackend');

    var queryParams = 'q=#$query##';
    var curatorVars = {};

    testTry = new TryFactory({ try_number: 0, query_params: queryParams, curator_vars: curatorVars });
    scope.settings = {selectedTry: testTry};
    scope.settings.searchUrl = 'http://example.com';
    scope.settings.searchEngine = 'solr';
    scope.settings.apiMethod = 'JSONP';
    scope.settings.fieldSpec = "id:id title:title";

    QueryparamsCtrl = $controller('QueryParamsCtrl', {
      $scope: scope
    });
  }));

  it('maps try_number in api to tryNo in JS obect', function (){
    expect(testTry.tryNo).toEqual(0);
  });

  it('extract no curator vars', function () {
    scope.qp.toggleTab();
    expect(scope.settings.selectedTry.curatorVars).toEqual([]);
  });

  it('extract should get on cv after adding', function () {
    scope.settings.selectedTry.queryParams = 'q=#$query##&boo=##testvar##';
    scope.qp.toggleTab();
    expect(scope.settings.selectedTry.curatorVars.length).toEqual(1);
    expect(scope.settings.selectedTry.curatorVars[0].name).toEqual('testvar');
    expect(scope.settings.selectedTry.curatorVars[0].value).toEqual(10);
    expect(scope.settings.selectedTry.curatorVars[0].inQueryParams).toBeTruthy();
  });

  it('initializes displayed vars to the right value', function() {
    scope.settings.selectedTry.queryParams = 'q=#$query##&boo=##testvar##';
    scope.settings.selectedTry.curatorVars = [{name: 'testvar', value: 1337}];
    scope.qp.toggleTab();
    expect(scope.settings.selectedTry.curatorVars[0].value).toEqual(1337);
    expect(scope.settings.selectedTry.curatorVars[0].inQueryParams).toBeTruthy();
  });

  it('initializes initially undisplayed vars to the right value', function() {
    $httpBackend.expectGET('api/cases/0/search_endpoints').respond(200, {});
    scope.settings.selectedTry.queryParams = 'q=#$query';
    scope.settings.selectedTry.curatorVars = [{name: 'testvar', value: 1337}];
    scope.qp.toggleTab();
    expect(scope.settings.selectedTry.curatorVars[0].inQueryParams).toBeFalsy();
    scope.settings.selectedTry.queryParams = 'q=#$query##&boo=##testvar##';
    scope.qp.toggleTab();
    scope.$apply();
    expect(scope.settings.selectedTry.curatorVars[0].value).toEqual(1337);
    expect(scope.settings.selectedTry.curatorVars[0].inQueryParams).toBeTruthy();
  });

  it('deleted vars retain value', function() {
    scope.settings.selectedTry.queryParams = 'q=#$query##&boo=##testvar##';
    scope.settings.selectedTry.curatorVars = [{name: 'testvar', value: 1337}];
    scope.qp.toggleTab();
    scope.settings.selectedTry.queryParams = 'q=#$query';
    scope.qp.toggleTab();
    expect(scope.settings.selectedTry.curatorVars[0].inQueryParams).toBeFalsy();
    expect(scope.settings.selectedTry.curatorVars[0].value).toEqual(1337);
  });

  it('handles multiple #$query## params', function() {
    scope.settings.selectedTry.queryParams = 'q=#$query##&foo=#$query##&boo=##testvar##';
    scope.qp.toggleTab();
    expect(scope.settings.selectedTry.curatorVars.length).toEqual(1);
    expect(scope.settings.selectedTry.curatorVars[0].name).toEqual('testvar');
    expect(scope.settings.selectedTry.curatorVars[0].value).toEqual(10);
    expect(scope.settings.selectedTry.curatorVars[0].inQueryParams).toBeTruthy();
  });
  it('does not require a proxy when Quepid (http) calls an https search endpoint', function() {
    $httpBackend.expectGET('api/cases/0/search_endpoints').respond(200, {});

    expect(scope.showProxyRequiredWarning).toBeFalsy();

    // Quepid running on http (default test env) calling an https search endpoint isn't
    // mixed content -- browsers only block http calls made from an https page.
    scope.settings.searchUrl = 'https://example.com';
    scope.settings.proxyRequests = false;

    scope.qp.toggleTab();

    expect(scope.showProxyRequiredWarning).toBeFalsy();
  });

});
