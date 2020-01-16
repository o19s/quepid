'use strict';
/*global jasmine*/
describe('Service: settingsSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var settingsSvc = null;
  var caseTryNavSvc = null;
  var $httpBackend = null;
  // TODO think about renaming mockSettings0 to mockSettings0Api to
  // be clear these are mocked up API calls.
  var mockSettings0 = {
    tries: [
      {
       'try_number': 0,
       'query_params': 'q=#$query##&fq=title:foo&fq=sub:bar',
       'curatorVars': {},
       'args': {'q': ['#$query##'],
                    'fq': ['title:foo', 'sub:bar']},
       'search_url': 'http://example.com:1234/solr/collection1',
       'search_engine': 'solr',
       'field_spec': 'thumb:field1 title sub',
       'escape_query': true,
       'name': 'try 0',
      },
      {
       'try_number': 1,
       'query_params': 'q=#$query##&fq=title:2&fq=ub:2',
       'curatorVars': {},
       'args': {'q': ['#$query##'],
                    'fq': ['title:foo', 'sub:2']},
       'search_url': 'http://example.com:1234/solr/collection1',
       'search_engine': 'solr',
       'field_spec': 'thumb:field1 title sub',
       'escape_query': true,
       'name': 'try 1',
      }
    ]

  };

  var mockSettings1 = {
    tries: [
      {
       'try_number': 0,
       'query_params': 'q=#$query##&fq=title:foo&fq=sub:bar',
       'curatorVars': {},
       'args': {'q': ['#$query##'],
                    'fq': ['title:foo', 'sub:bar']},
       'search_url': 'http://doug.com:1234/solr/collection1',
       'search_engine':'solr',
       'field_spec': 'thumb:field1 title sub2',
       'escape_query': true,
       'name': 'try 0',
      },
      {
       'try_number': 1,
       'query_params': 'q=#$query##&bq=title:foo^##titleboost##&bq=sub:2',
       'curatorVars': {titleboost: 5},
       'args': {'q': ['#$query##'],
                    'bq': ['title:foo^5', 'sub:2']},
       'search_url': 'http://doug.com:1234/solr/collection1',
       'search_engine':'solr',
       'field_spec': 'thumb:field1 title sub2',
       'escape_query': true,
       'name': 'try 1',
      },
      {
       'try_number': 2,
       'query_params': 'q=#$query##&bq=title:##titleboost##&bq=sub:2&qf=title',
       'curatorVars': {titleboost: 5},
       'args': {'q': ['#$query##'],
                    'bq': ['title:foo^5', 'sub:2'],
                    'qf': ['title']},
       'search_url': 'http://doug.com:1234/solr/collection1',
       'search_engine':'solr',
       'field_spec': 'thumb:field1 title sub2',
       'escape_query': true,
       'name': 'try 2',
      }
    ]

  };

  var locationMock = null;
  var querySvcMock = null;

  beforeEach(function() {
    locationMock = {
      path: jasmine.createSpy(),
      search: jasmine.createSpy()
    };
    querySvcMock = {
      changeSettings: jasmine.createSpy()
    };
    module(function($provide) {
      $provide.value('$location', locationMock);
      $provide.value('queriesSvc', querySvcMock);
    });
    /*jshint camelcase:false*/
    inject(function (_settingsSvc_, _caseTryNavSvc_, $injector) {
      settingsSvc = _settingsSvc_;
      caseTryNavSvc = _caseTryNavSvc_;
      $httpBackend = $injector.get('$httpBackend');
    });
    /*jshint camelcase:true*/
  });


  it(' gets settings on case change', function () {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings0);
    settingsSvc.bootstrap(0, 0)
    .then(function() {
      var settingsCpy = settingsSvc.editableSettings();
      expect(settingsCpy.fieldSpec).toBe(mockSettings0.tries[0].field_spec);
      expect(settingsCpy.searchUrl).toBe(mockSettings0.tries[0].search_url);
      expect(settingsCpy.tries[0].queryParams)
            .toEqual(mockSettings0.tries[0].query_params);
      expect(settingsCpy.tries[0].curatorVarsDict())
            .toEqual(mockSettings0.tries[0].curatorVars);
      expect(settingsCpy.tries[1].queryParams)
            .toEqual(mockSettings0.tries[1].query_params);
      expect(settingsCpy.tries[1].curatorVarsDict())
            .toEqual(mockSettings0.tries[1].curatorVars);
    });
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  describe('curator vars', function() {
    var mockCvSettings = {
      tries: [
        {
         'try_number': 0,
         'query_params': 'q=#$query##&bq=title:##titleboost##&bq=sub:2&qf=title',
         'curatorVars': {titleboost: 5, missing: 11},
         'args': {'q': ['#$query##'],
                      'bq': ['title:foo^5', 'sub:2'],
                      'qf': ['title']},
         'search_url': 'http://doug.com:1234/solr/collection1',
         'search_engine':'solr',
         'field_spec': 'thumb:field1 title sub2',
         'name': 'try 0'
        }
      ]

    };
    beforeEach(function() {
      $httpBackend.expectGET('/api/cases/0/tries')
                  .respond(200,  mockCvSettings);
      settingsSvc.bootstrap(0, 0);
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('marks curatorVars as in the query params',  function() {
      var settingsCpy = settingsSvc.editableSettings();
      var cvs = settingsCpy.tries[0].curatorVars;
      expect(cvs.length).toBe(2);
      angular.forEach(cvs, function(cv) {
        if (cv.name === 'titleboost') {
          expect(cv.inQueryParams).toBeTruthy();
        }
        else if (cv.name === 'missing') {
          expect(cv.inQueryParams).toBeFalsy();
        }
      });
    });

    it('sorts alphabetically', function() {
      var settingsCpy = settingsSvc.editableSettings();
      var cvs = settingsCpy.tries[0].curatorVars;
      expect(cvs.length).toBe(2);
      expect(cvs[0].name).toBe('missing');
      expect(cvs[1].name).toBe('titleboost');
    });
  });


  it('switches cases', function () {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings0);
    caseTryNavSvc.navigationCompleted({caseNo: 0, tryNo: 0});
    settingsSvc.bootstrap();
    $httpBackend.flush();

    $httpBackend.expectGET('/api/cases/1/tries')
                .respond(200,  mockSettings1);
    caseTryNavSvc.navigationCompleted({caseNo: 1, tryNo: 0});
    settingsSvc.bootstrap()
    .then(function() {
      var settingsCpy = settingsSvc.editableSettings();
      expect(settingsCpy.fieldSpec).toBe(mockSettings1.tries[0].field_spec);
      expect(settingsCpy.searchUrl).toBe(mockSettings1.tries[0].search_url);
      expect(settingsCpy.tries[0].queryParams)
            .toEqual(mockSettings1.tries[0].query_params);
      expect(settingsCpy.tries[0].curatorVarsDict())
            .toEqual(mockSettings1.tries[0].curatorVars);
      expect(settingsCpy.tries[1].queryParams)
            .toEqual(mockSettings1.tries[1].query_params);
      expect(settingsCpy.tries[1].curatorVarsDict())
            .toEqual(mockSettings1.tries[1].curatorVars);
      expect(settingsCpy.tries[2].queryParams)
            .toEqual(mockSettings1.tries[2].query_params);
      expect(settingsCpy.tries[2].curatorVarsDict())
            .toEqual(mockSettings1.tries[2].curatorVars);
    });
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

  });

  var mockTry = {
    'query_params': 'ADDED',
    'curatorVars': {},
    'args': {},
    'search_url': 'http://doug.com:1234/solr/collection1',
    'search_engine':'solr',
    'field_spec': 'thumb:field1 title sub2',
    'try_number': 2,
    'name': 'try 2'
  };

  it('saves new tries', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
      .respond(200,  mockSettings0);

    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    $httpBackend.expectPOST('/api/cases/0/tries')
      .respond(200,  mockTry);

    var editableSettings = settingsSvc.editableSettings();
    editableSettings.selectedTry.queryParams = 'ADDED';
    settingsSvc.save(editableSettings);
    $httpBackend.flush();

    expect(locationMock.path).toHaveBeenCalledWith('/case/0/try/2/');
    $httpBackend.verifyNoOutstandingExpectation();
  });


  var mockSettingsChangeFieldSpecResp = {
    args:        {
      'q': ['#$query##'],
      'bq': ['title:foo^5', 'sub:2'],
      'qf': ['title']
    },
    curatorVars:  { titleboost: 5 },
    escape_query:  false,
    field_spec:    'CHANGED',
    name:          'try 2',
    query_params:  'q=#$query##&bq=title:##titleboost##&bq=sub:2&qf=title',
    search_url:    'http://doug.com:1234/solr/collection1',
    search_engine: 'solr',
    try_number:    2,
  };

  it('saves changes to fieldSpec', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings0);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    $httpBackend.expectPOST('/api/cases/0/tries')
                .respond(200,  mockSettingsChangeFieldSpecResp);
    var editableSettings = settingsSvc.editableSettings();
    editableSettings.fieldSpec = 'CHANGED';
    settingsSvc.save(editableSettings);
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

    var currSettings = settingsSvc.editableSettings();
    expect(currSettings.selectedTry.fieldSpec).toBe('CHANGED');
    expect(currSettings.selectedTry.searchUrl).toBe('http://doug.com:1234/solr/collection1');
  });

  it('saves escapeQuery', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings0);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();
    $httpBackend.expectPOST('/api/cases/0/tries')
                .respond(200,  mockSettingsChangeFieldSpecResp);
    var editableSettings = settingsSvc.editableSettings();
    expect(editableSettings.selectedTry.escapeQuery).toBe(true);
    editableSettings.escapeQuery = false;
    settingsSvc.save(editableSettings);
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();

    var currSettings = settingsSvc.editableSettings();
    expect(currSettings.selectedTry.escapeQuery).toBe(false);
  });

  var mockSettingsAddNewVarsResp = {
    'try_number': 2,
    'query_params': 'q=#$query##&fq=title:foo&fq=sub:bar&new=##newvar##',
    'curatorVars': {newvar: 10},
    'args': {
      'q':    ['#$query##'],
      'fq':   ['title:foo', 'sub:bar'],
      'new':  ['10']
    },
    'search_url': 'http://doug.com:1234/solr/collection1',
    'search_engine':'solr',
    'escape_query': true,
    'field_spec': 'thumb:field1 title sub2'
  };

  it('gathers new curatorVars on submit', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings0);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    $httpBackend.expectPOST('/api/cases/0/tries')
                .respond(200,  mockSettingsAddNewVarsResp);
    var editableSettings = settingsSvc.editableSettings();
    editableSettings.selectedTry.queryParams += '&new=##newvar##';
    settingsSvc.save(editableSettings);

    $httpBackend.flush();
    //$httpBackend.verifyNoOutstandingExpectation(); <!-- there's also a get to /cases/0/tries/0

    var backendVars = settingsSvc.applicableSettings().curatorVarsDict();
    expect(backendVars.newvar).toBe(10);
  });

  it('handles deleted settings', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings1);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();
    var settingsCpy = settingsSvc.editableSettings();
    $httpBackend.expectDELETE('/api/cases/0/tries/1')
                .respond(200);
    settingsSvc.deleteTry(1);
    $httpBackend.flush();
    settingsCpy = settingsSvc.editableSettings();
    expect(settingsCpy.tries[0].deleted).toBeFalsy();
    expect(settingsCpy.tries[1].deleted).toBeTruthy();
    expect(settingsCpy.tries[2].deleted).toBeFalsy();
  });

  it('handles deleting selected try', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings1);
    var lastTry = mockSettings1.tries[2].try_number;
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();
    var settingsCpy = settingsSvc.editableSettings();
    $httpBackend.expectDELETE('/api/cases/0/tries/' + settingsCpy.selectedTry.tryNo)
                .respond(200);
    settingsSvc.deleteTry(settingsCpy.selectedTry.tryNo);
    $httpBackend.flush();
    settingsCpy = settingsSvc.editableSettings();
    // expect navigation!
    expect(locationMock.path).toHaveBeenCalledWith('/case/0/try/' + lastTry + '/');
  });

  it('wont delete last try', function() {
    var mockSettingsDel = angular.copy(mockSettings1);
    mockSettingsDel.tries.splice(1,2);
    var remTry = mockSettingsDel.tries[0];
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettingsDel);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    settingsSvc.deleteTry(remTry.tryNo);

    var settingsCpy = settingsSvc.editableSettings();
    expect(settingsCpy.tries.length).toBe(1);
    expect(settingsCpy.tries[0].deleted).toBeFalsy();

    $httpBackend.verifyNoOutstandingExpectation();

  });

  it('updates settingsId after delete', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings1);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();
    var settingsId = settingsSvc.settingsId();
    console.log('id1:' + settingsId);
    $httpBackend.expectDELETE('/api/cases/0/tries/1')
                .respond(200);
    settingsSvc.deleteTry(1);
    $httpBackend.flush();
    console.log('id2:' + settingsSvc.settingsId());
    expect(settingsSvc.settingsId()).not.toEqual(settingsId);
  });

  it('bootstraps with deleted tries', function() {
    var mockSettingsDel = angular.copy(mockSettings1);
    var splicedTry = mockSettingsDel.tries[1].try_number;
    mockSettingsDel.tries.splice(1,1);
    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettingsDel);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    var settingsCpy = settingsSvc.editableSettings();
    expect(settingsCpy.tries[0].tryNo).not.toBe(splicedTry);
    expect(settingsCpy.tries.length).toBe(2);
    expect(settingsCpy.tries[1].tryNo).not.toBe(splicedTry);

  });

  it('renames tries', function() {
    $httpBackend.expectGET('/api/cases/0/tries')
      .respond(200,  mockSettings1);

    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    var newName = 'foo try';
    var called = 0;
    var settingsId = settingsSvc.settingsId();

    $httpBackend.expectPUT('/api/cases/0/tries/0')
      .respond(200, {'name': newName});

    settingsSvc.renameTry(0, newName)
      .then(function() {
        called++;
      });
    $httpBackend.flush();

    var settingsCpy = settingsSvc.editableSettings();
    angular.forEach(settingsCpy.tries, function(aTry) {
      if (aTry.tryNo === 0) {
        called++;
        expect(aTry.name).toBe(newName);
      }
    });

    expect(called).toBe(2);
    expect(settingsSvc.settingsId()).not.toEqual(settingsId);
  });

  it('clones a try', function() {
    //var aTry  = mockSettings1.tries[0];
    var mockResponse = {
     'try_number':   3,
     'query_params': 'q=#$query##&fq=title:foo&fq=sub:bar',
     'curatorVars': {},
     'args':        {'q': ['#$query##'],
                     'fq': ['title:foo', 'sub:bar']},
     'search_url':  'http://doug.com:1234/solr/collection1',
     'search_engine':'solr',
     'field_spec':    'thumb:field1 title sub2',
     'escape_query': true,
     'name':        'try 3'
    };

    $httpBackend.expectGET('/api/cases/0/tries')
                .respond(200,  mockSettings1);
    settingsSvc.bootstrap(0, 0);
    $httpBackend.flush();

    var settingsCpy = settingsSvc.editableSettings();
    var tries = settingsCpy.tries;

    var aTry = tries[0];

    $httpBackend.expectPOST('/api/clone/cases/0/tries/0')
                .respond(200,  mockResponse);

    settingsSvc.duplicateTry(aTry.tryNo);

    $httpBackend.flush();

    settingsCpy = settingsSvc.editableSettings();
    var updatedTries = settingsCpy.tries;

    expect(updatedTries.length).toBe(tries.length + 1);
  });
});
