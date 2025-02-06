'use strict';

describe('Service: querySnapshotSvc', function () {

  // load the service's module
  beforeEach(module('QuepidApp'));

  // instantiate service
  var querySnapshotSvc;
  var $rootScope;
  var $q;
  var $httpBackend = null;
  var settingsSvc = null;
  var docResolverSvc;

  var recordDocumentFields = false;

  beforeEach(function() {
    module(function($provide) {
      /*global MockSettingsSvc*/
      settingsSvc = new MockSettingsSvc();
      $provide.value('settingsSvc',     settingsSvc);
    });
    /* jshint camelcase: false */
    inject(function (_$rootScope_, _$q_, _querySnapshotSvc_, _fieldSpecSvc_, _docResolverSvc_, $injector) {
      $httpBackend      = $injector.get('$httpBackend');
      $rootScope        = _$rootScope_;
      $q                = _$q_;
      querySnapshotSvc  = _querySnapshotSvc_;
      docResolverSvc    = _docResolverSvc_;
      var mockFieldSpec = _fieldSpecSvc_.createFieldSpec('field field1');

      settingsSvc.setMockFieldSpec(mockFieldSpec);

      spyOn(docResolverSvc, "createResolver").and
        .callFake(function(ids, settings) {
          /*global MockResolver*/
          this.mockResolver = new MockResolver(ids, settings, $q);
          return this.mockResolver;
        });
    });
  });

  beforeEach(function() {
    // bootstrap as if no snapshots exist yet
    $httpBackend.expectGET('api/cases/2/snapshots?shallow=true')
      .respond(200, {'snapshots': {}});
    querySnapshotSvc.bootstrap(2);
    $httpBackend.flush();
  });

  var basicExplain1 = {
    match: true,
    value: 1.5,
    description: 'weight(text:law in 1234)',
    details: []
  };
  var rawExpl = angular.toJson(basicExplain1);
  var explFunc = function() {
    return {rawStr: function() {return rawExpl;}};
  };

  var getNumFound = function() {
    return 42;
  };

  var mockQueries = [
    {'queryId': 0,
     getNumFound: getNumFound,
    'currentScore': {'score':0.45, 'allRated': true},
     'docs': [{'id': '1', explain: explFunc}, {'id': '4', explain: explFunc}, {'id': '7', explain: explFunc}]},
    {'queryId': 1,
     getNumFound: getNumFound,
    'currentScore': {'score':'--', 'allRated': false},
     'docs': [{'id': 'cat', explain: explFunc}, {'id': 'banana', explain: explFunc}, {'id': 'dog', explain:explFunc}]}
  ];

  /* jshint indent: false */
  var mockSnapResp =
    {'snapshots': {
      '5': /*snapshot id*/
           {id: '5', /*query id*/
            name: 'myname',
            time: '1392318891',
            docs: { /*the search results for this query*/
              '0': [{id: '1', explain: rawExpl}, {id: '4', explain: rawExpl}, {id: '7', explain: rawExpl}],
              '1': [{id: 'cat', explain: rawExpl}, {id: 'banana', explain: rawExpl}, {id: 'doc', explain: rawExpl}],
             }
          },
      '12':
           {id: '12',
            name: 'other',
            time: '0',
            docs: {
              '9':  [{id: 'lol', explain: rawExpl}, {id: 'wut', explain: rawExpl}],
              '10': [{id: 'light', explain: rawExpl}, {id: 'lamp', explain: rawExpl}, {id: 'lark', explain: rawExpl}],
             }
          }
    }};

  it('bootstraps', function() {
    $httpBackend.expectGET('api/cases/3/snapshots?shallow=true').respond(200, mockSnapResp);
    querySnapshotSvc.bootstrap(3);
    $httpBackend.flush();

    expect(querySnapshotSvc.snapshots['5'].id).toBe('5');
    expect(querySnapshotSvc.snapshots['5'].docIdsPerQuery['0']).toEqual(['1', '4', '7']);
    expect(querySnapshotSvc.snapshots['5'].docIdsPerQuery['1']).toEqual(['cat', 'banana', 'doc']);
    expect(querySnapshotSvc.snapshots['5'].name()).toEqual('(1/17/70) myname');
    expect(querySnapshotSvc.snapshots['12'].id).toBe('12');
    expect(querySnapshotSvc.snapshots['12'].docIdsPerQuery['9']).toEqual(['lol', 'wut']);
    expect(querySnapshotSvc.snapshots['12'].docIdsPerQuery['10']).toEqual(['light', 'lamp', 'lark']);
    expect(querySnapshotSvc.snapshots['12'].name()).toEqual('(1/1/70) other');
    $httpBackend.verifyNoOutstandingExpectation();

  });

  it('resolves docids on bootstrap', function() {
    $httpBackend.expectGET('api/cases/3/snapshots?shallow=true').respond(200, mockSnapResp);
    querySnapshotSvc.bootstrap(3);
    $httpBackend.flush();

    var mockResolver = docResolverSvc.mockResolver;
    $rootScope.$apply();

    var resolvedIds = [];
    angular.forEach(mockResolver.docs, function loopBody(doc) {
      resolvedIds.push(doc.id);
    });
    expect(resolvedIds.length).toBe(11);
    expect(resolvedIds).toContain('1');
    expect(resolvedIds).toContain('4');
    expect(resolvedIds).toContain('7');
    expect(resolvedIds).toContain('cat');
    expect(resolvedIds).toContain('banana');
    expect(resolvedIds).toContain('doc');
    expect(resolvedIds).toContain('lol');
    expect(resolvedIds).toContain('wut');
    expect(resolvedIds).toContain('light');
    expect(resolvedIds).toContain('lamp');
    expect(resolvedIds).toContain('lark');

  });

  it('doesnt rebootstrap if same case', function() {
    querySnapshotSvc.bootstrap(2);
    querySnapshotSvc.bootstrap(2);
    // verify no HTTP occured...
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('does not update version if same case', function() {
    var priorVersion = querySnapshotSvc.version();
    querySnapshotSvc.bootstrap(2);
    querySnapshotSvc.bootstrap(2);
    expect(querySnapshotSvc.version()).toBe(priorVersion);
  });

  describe('adding snapshots', function() {
    var addedSnapResp = {
      id:   '5',
      name: 'myname',
      time: '1392318891',
      docs: {
        '0': [
          {id: '1', explain: rawExpl},
          {id: '4', explain: rawExpl},
          {id: '7', explain: rawExpl}
        ],
        '1': [
          {id: 'cat', explain: rawExpl},
          {id: 'banana', explain: rawExpl},
          {id: 'doc', explain: rawExpl}
        ],
      },
      queries: {
        '0': {
          score: 0.45,
          all_rated: true
        },
        '1': {
          score: 9,
          all_rated: false
        }
      }
    };

    it('should snapshot the passed in docs', function () {
      $httpBackend.expectPOST('api/cases/2/snapshots', function(response) {
        var reqJson = angular.fromJson(response);
        var valid = true;
        valid = (valid && reqJson.snapshot.name === 'myname');
        valid = (valid && reqJson.snapshot.docs['0'][0].id === '1');
        valid = (valid && reqJson.snapshot.docs['0'][0].explain === rawExpl);
        valid = (valid && reqJson.snapshot.queries[0].score === 0.45);
        valid = (valid && reqJson.snapshot.queries[0].all_rated === true);

        // Can't figure out how to make this check work!
        //valid = (valid && angular.isUndefined(reqJson.snapshot.queries[1].score ));
        valid = (valid && reqJson.snapshot.queries[1].all_rated === false);
        return valid;
      }).respond(200, addedSnapResp);

      // Make sure how we defined the getNumFound() function works!
      expect (mockQueries[0].getNumFound()).toEqual(42);

      querySnapshotSvc.addSnapshot('myname', recordDocumentFields, mockQueries);
      $httpBackend.flush();
      expect(querySnapshotSvc.snapshots['5'].id).toBe('5');
      expect(querySnapshotSvc.snapshots['5'].docIdsPerQuery['0']).toEqual(['1', '4', '7']);
      expect(querySnapshotSvc.snapshots['5'].docIdsPerQuery['1']).toEqual(['cat', 'banana', 'doc']);
      expect(querySnapshotSvc.snapshots['5'].name()).toEqual('(1/17/70) myname');
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('updates the version on new snapshot', function() {
      var priorVersion = querySnapshotSvc.version();
      $httpBackend.expectPOST('api/cases/2/snapshots')
                  .respond(200, addedSnapResp);
      querySnapshotSvc.addSnapshot('myname', recordDocumentFields, mockQueries);
      $httpBackend.flush();
      expect(querySnapshotSvc.version()).toEqual(priorVersion + 1);
      $httpBackend.verifyNoOutstandingExpectation();

    });

    it('resolves ids->docs', function resolveAddSnapTest() {
      $httpBackend.expectPOST('api/cases/2/snapshots')
                  .respond(200, addedSnapResp);
      querySnapshotSvc.addSnapshot('myname', recordDocumentFields, mockQueries);
      $httpBackend.flush();

      var mockResolver = docResolverSvc.mockResolver;
      $rootScope.$apply();

      var resolvedIds = [];
      angular.forEach(mockResolver.docs, function loopBody(doc) {
        resolvedIds.push(doc.id);
      });
      expect(resolvedIds.length).toBe(6);
      expect(resolvedIds).toContain('1');
      expect(resolvedIds).toContain('4');
      expect(resolvedIds).toContain('7');
      expect(resolvedIds).toContain('cat');
      expect(resolvedIds).toContain('banana');
      expect(resolvedIds).toContain('doc');
    });
  });

  describe('deleting snapshots', function() {
    it('deletes by id', function() {
      $httpBackend.expectGET('api/cases/3/snapshots?shallow=true').respond(200, mockSnapResp);
      querySnapshotSvc.bootstrap(3);
      $httpBackend.flush();

      $httpBackend.expectDELETE('api/cases/3/snapshots/5')
                    .respond(200, '');
      var promise = querySnapshotSvc.deleteSnapshot(5);
      var called = 0;
      promise.then(function() {
        called++;
        expect(Object.keys(querySnapshotSvc.snapshots).length).toEqual(1);
        expect(querySnapshotSvc.snapshots['5']).toEqual(undefined);
        expect(querySnapshotSvc.snapshots['12'].name()).toContain('other');
      });
      $httpBackend.flush();
      expect(called).toBe(1);
    });

    it('deletes update version', function() {
      $httpBackend.expectGET('api/cases/3/snapshots?shallow=true').respond(200, mockSnapResp);
      querySnapshotSvc.bootstrap(3);
      $httpBackend.flush();

      $httpBackend.expectDELETE('api/cases/3/snapshots/5')
                    .respond(200, '');
      var promise = querySnapshotSvc.deleteSnapshot(5);
      var called = 0;
      var versionBefore = querySnapshotSvc.version();
      promise.then(function() {
        called++;
        expect(querySnapshotSvc.version()).not.toEqual(versionBefore);
      });
      $httpBackend.flush();
      expect(called).toBe(1);
    });
  });

  describe('querySnapshotSvc getters', function () {

    beforeEach(function() {
      $httpBackend.expectGET('api/cases/3/snapshots?shallow=true').respond(200, mockSnapResp);
      querySnapshotSvc.bootstrap(3);
      $httpBackend.flush();

      var mockResolver = docResolverSvc.mockResolver;
      $rootScope.$apply();
    });

    it('gets saved search results in saved order', function fetchAfterResolveTest() {
      var snap5 = querySnapshotSvc.snapshots['5'];
      var snap5query0Results = snap5.getSearchResults('0');
      expect(snap5query0Results[0].id).toEqual('1');
      expect(snap5query0Results[1].id).toEqual('4');
      expect(snap5query0Results[2].id).toEqual('7');
      var snap5query1Results = snap5.getSearchResults('1');
      expect(snap5query1Results[0].id).toEqual('cat');
      expect(snap5query1Results[1].id).toEqual('banana');
      expect(snap5query1Results[2].id).toEqual('doc');

      var snap12 = querySnapshotSvc.snapshots['12'];
      var snap12query9Results = snap12.getSearchResults('9');
      expect(snap12query9Results[0].id).toEqual('lol');
      expect(snap12query9Results[1].id).toEqual('wut');
      var snap12query10Results = snap12.getSearchResults('10');
      expect(snap12query10Results[0].id).toEqual('light');
      expect(snap12query10Results[1].id).toEqual('lamp');
      expect(snap12query10Results[2].id).toEqual('lark');

    });

  });

  describe('overlapping snapshots', function() {
    var basicExplain1 = {
      match: true,
      value: 1.5,
      description: 'weight(text:law in 1234)',
      details: []
    };
    var basicExplain2 = {
      match: true,
      value: 2.5,
      description: 'weight(text:law in 1234)',
      details: []
    };
    //var rawExpl = angular.toJson(basicExplain1);

    var mockOverlapSnapResp = {
      'snapshots': [
        {
          'id':   '1',  /* snapshot id */
          'name': 'New Snapshot',
          'time': '1392318891',
          'docs': {
            '1': [ /*query id*/
              { 'id': 'i_801', 'explain': basicExplain1 },
              { 'id': 'i_802', 'explain': basicExplain2 }
            ],
            '2': [ /*query id*/
              { 'id': 'i_802', 'explain': basicExplain1 },
              { 'id': 'i_801', 'explain': basicExplain2 }
            ]
          }
        }
      ]
    };

    it('gets unique explains per query despite identical doc ids', function uniquePerDocIdTest() {
      $httpBackend.expectGET('api/cases/3/snapshots?shallow=true').respond(200, mockOverlapSnapResp);
      querySnapshotSvc.bootstrap(3);
      $httpBackend.flush();

      var mockResolver = docResolverSvc.mockResolver;
      $rootScope.$apply();
      var snap1 = querySnapshotSvc.snapshots['1'];

      var snap1query1Results = snap1.getSearchResults('1');
      var snap1query2Results = snap1.getSearchResults('2');
      expect(snap1query1Results[0].explain().score).toEqual(basicExplain1.value);
      expect(snap1query1Results[0].id).toEqual('i_801');
      expect(snap1query1Results[1].explain().score).toEqual(basicExplain2.value);
      expect(snap1query1Results[1].id).toEqual('i_802');

      expect(snap1query2Results[0].explain().score).toEqual(basicExplain1.value);
      expect(snap1query2Results[0].id).toEqual('i_802');
      expect(snap1query2Results[1].explain().score).toEqual(basicExplain2.value);
      expect(snap1query2Results[1].id).toEqual('i_801');

    });
  });

  describe('Get snapshot', function() {
    var $rootScope;

    beforeEach(function() {
      inject(function (_$rootScope_) {
        $rootScope = _$rootScope_;
      });
    });

    var mockSnapResp = {
      'id':   '1',  /* snapshot id */
      'name': 'New Snapshot',
      'time': '1392318891',
      'docs': {
        '1': [ /*query id*/
          { 'id': 'i_801', 'explain': null },
          { 'id': 'i_802', 'explain': null }
        ],
        '2': [ /*query id*/
          { 'id': 'i_803', 'explain': null }
        ]
      }
    };

    it('fetches a snapshot', function() {
      var url = 'api/cases/2/snapshots/1?shallow=true';
      $httpBackend.expectGET(url).respond(200, mockSnapResp);

      querySnapshotSvc.get(1);

      $httpBackend.flush();
      $rootScope.$apply();

      var snapshot = querySnapshotSvc.snapshots[1];

      expect(snapshot).not.toBe(null);
      expect(Object.keys(snapshot.docs).length).toBe(2);
    });
  });

  describe('Import snapshots', function() {
    var $rootScope;

    beforeEach(function() {
      inject(function (_$rootScope_) {
        $rootScope = _$rootScope_;
      });
    });

    var mockCsv = [
      {
        'Snapshot Name':  'New Snapshot',
        'Query Text':     'dog',
        'Doc Position':   '1',
        'Doc ID':         'i_801',
        'Case ID':        '8'
      },
      {
        'Snapshot Name':  'New Snapshot',
        'Query Text':     'dog',
        'Doc Position':   '2',
        'Doc ID':         'i_802',
        'Case ID':        '8'
      },
      {
        'Snapshot Name':  'New Snapshot',
        'Query Text':     'cat',
        'Doc Position':   '1',
        'Doc ID':         'i_803',
        'Case ID':        '8'
      },
      {
        'Snapshot Name':  'New Snapshot 2',
        'Query Text':     'dog',
        'Doc Position':   '1',
        'Doc ID':         'i_804',
        'Case ID':        '8'
      }
    ];

    var firstMockSnapResp = {
      snapshots: [
        {
          'id':   '1',  /* snapshot id */
          'name': 'New Snapshot',
          'time': '1392318891',
          'docs': {
            '1': [ /*query id*/
              { 'id': 'i_801', 'explain': null },
              { 'id': 'i_802', 'explain': null }
            ],
            '2': [ /*query id*/
              { 'id': 'i_803', 'explain': null }
            ]
          }
        }
      ]
    };

    var secondMockSnapResp = {
      snapshots: [
        {
          'id':   '2',  /* snapshot id */
          'name': 'New Snapshot 2',
          'time': '1392318891',
          'docs': {
            '1': [ /*query id*/
              { 'id': 'i_804', 'explain': null }
            ]
          }
        }
      ]
    };

    it('imports multiple snapshots for the same case', function() {
      var url = 'api/cases/8/snapshots/imports';
      $httpBackend.expectPOST(url).respond(200, firstMockSnapResp);
      $httpBackend.expectPOST(url).respond(200, secondMockSnapResp);

      querySnapshotSvc.importSnapshots(mockCsv);

      $httpBackend.flush();
      $rootScope.$apply();

      expect(Object.keys(querySnapshotSvc.snapshots).length).toBe(2);
    });
  });
  
  describe('Mapping fieldSpec back to /search endpoint expectations', function() {    
    it('handles various patterns', function() {
      expect(querySnapshotSvc.mapFieldSpecToSolrFormat('id:id title:title body')).toBe('id:id title:title body');
      expect(querySnapshotSvc.mapFieldSpecToSolrFormat('id:_id title:title body')).toBe('id:id title:title body');
      expect(querySnapshotSvc.mapFieldSpecToSolrFormat('title:title id:_id body')).toBe('title:title id:id body');
      expect(querySnapshotSvc.mapFieldSpecToSolrFormat('id title:title body')).toBe('id title:title body');
    });    
  });
});
