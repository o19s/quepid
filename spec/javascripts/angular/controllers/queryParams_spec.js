'use strict';

describe('Controller: QueryparamsCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var QueryparamsCtrl,
    scope,
    testTry;


  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope, settingsSvc, TryFactory) {
    scope = $rootScope.$new();

    var queryParams = 'q=#$query##';
    var curatorVars = {};

    testTry = new TryFactory({ tryNo: 0, query_params: queryParams, curatorVars: curatorVars });
    scope.settings = {selectedTry: testTry};
    scope.settings.searchUrl = 'http://example.com';
    scope.settings.searchEngine = 'solr';
    scope.settings.apiMethod = 'JSONP';
    scope.settings.fieldSpec = "id:id title:title";

    QueryparamsCtrl = $controller('QueryParamsCtrl', {
      $scope: scope
    });
  }));

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

  it('handles changing TLS from http to https when you start on http', function () {
    expect(scope.showTLSChangeWarning).toBeFalsy();
    scope.settings.searchUrl = 'https://example.com'
    scope.qp.toggleTab();
    expect(scope.showTLSChangeWarning).toBeTruthy();
    expect(scope.quepidUrlToSwitchTo).toEqual('https://server/?searchEngine=solr&searchUrl=https://example.com&showWizard=false&apiMethod=JSONP&fieldSpec=id:id title:title')
    scope.settings.searchUrl = 'http://example.com'
    scope.qp.toggleTab();
    expect(scope.showTLSChangeWarning).toBeFalsy();
    //expect(scope.quepidUrlToSwitchTo).toEqual('http://server/')
  });

});
