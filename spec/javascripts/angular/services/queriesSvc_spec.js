'use strict';

describe('Service: queriesSvc', function () {
  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var $httpBackend = null;
  var $rootScope;
  var $q;
  var fieldSpecSvc = null;
  var queriesSvc = null;
  var mockFieldSpec = null;
  var mockSettings;
  var mockSearchSvc;
  var mockScorerSvc;
  var mockCaseSvc;
  
  var mockSolrUrl =  "http://example.com:1234/solr/example";

  var mockTry = {
    args: {
      q: ['#$query##'],
    },
    searchUrl: mockSolrUrl,
    fieldSpec: '',
    tryNo: 2
  };

  var mockFullQueriesResp = {
    display_order: [2,1,0],
    queries: [
      {
        'arranged_at':   '3681400536',
        'arranged_next': '4294967295',
        'deleted':      'false',
        'query_id':      '0',
        'query_text':   'symptoms of heart attack',
        'ratings':      {
          'doc1': '5',
          'doc2': '9'
        }
      },
      {
        'arranged_at':   '3067833780',
        'arranged_next': '3681400536',
        'deleted':      'true',
        'query_id':      '1',
        'query_text':   'how is kidney cancer diagnosed'
      },
      {
        'arranged_at':   '0',
        'arranged_next': '613566756',
        'deleted':      'false',
        'l_31284':      '10',
        'query_id':      '2',
        'query_text':   'prognosis of alzheimers',
        'ratings':      {
          'doc1': '1',
          'doc2': '10'
        }
      }
    ]
  };

  var mockResults = {
    response: {
      numFound: 2,
      docs : [
      {id: 'doc1', field1: 'doc1field1val', field2: 'doc1field2val',
        origin:function()  {return this;}, highlight: function() {return null;}, explain: function() {return null;}},
      {id: 'doc2', field1: 'doc2field1val', field2: 'doc2field2val',
        origin:function() {return this;},  highlight: function() {return null;}, explain: function() {return null;}}
      ]
    }
  };

  var MockSearcher = function(settings, queryText) {
    var promises = [];

    this.docs = [];
    this.settings = settings;

    // force a search success
    this.fulfill = function(mockResp) {
      var thisMockSearcher = this;
      this.docs.length = 0;
      angular.forEach(mockResp.response.docs, function(solrDoc) {
        solrDoc.url = function() {
          return settings.searchUrl + '?tokensUrl=true';
        };
        if (!solrDoc.hasOwnProperty('explain')) {
          solrDoc.explain = function() {
            return null;
          };
        }
        thisMockSearcher.docs.push(solrDoc);
      });

      this.resolvePromises();
    };

    // force a search failure
    this.fail = function() {
      this.inError = true;
      this.resolvePromises();
    };

    this.linkUrl = settings.searchUrl + '?linkUrl=true';

    this.search = function() {
      var currPromise = $q.defer();
      promises.push(currPromise);

      return currPromise.promise;
    };

    this.queryText = function() {
      return queryText;
    };

    this.resolvePromises = function() {
      angular.forEach(promises, function(promise){
        promise.resolve();
      });
    }
  };

  var MockSearchSvc = function() {
    this.escapeUserQuery = function(queryText) {
      return 'escaped' + queryText;
    };

    var searchers = [];

    this.reset = function() {
      searchers.length = 0;
    };

    this.lastSearcher = function() {
      return searchers[searchers.length - 1];
    };

    this.searchers = function() {
      return searchers;
    };

    this.createSearcher = function(fieldList, searchUrl, args, queryText) {
      var settings = {};
      settings.searchUrl = searchUrl;
      settings.args = args;
      settings.queryText = queryText;

      var newSearcher = new MockSearcher(settings, queryText, {});

      searchers.push(newSearcher);

      return newSearcher;
    };

    this.fulfill = function(mockResp) {
      angular.forEach(searchers, function(searcher) {
        return searcher.fulfill(mockResp);
      });
    };

    this.fail = function() {
      angular.forEach(searchers, function(searcher) {
        return searcher.fail();
      });
    };
  };

  beforeEach(function() {

    module(function($provide) {
      mockSearchSvc = new MockSearchSvc();
      mockScorerSvc = new MockScorerSvc();
      mockCaseSvc   = new MockCaseSvc();
      $provide.value('searchSvc', mockSearchSvc);
      $provide.value('scorerSvc', mockScorerSvc);
      $provide.value('caseSvc', mockCaseSvc);
    });

    inject(function(_$rootScope_, _$q_, $injector, _queriesSvc_, _fieldSpecSvc_) {
      $httpBackend  = $injector.get('$httpBackend');
      $rootScope    = _$rootScope_;
      $q            = _$q_;
      fieldSpecSvc  = _fieldSpecSvc_;
      queriesSvc    = _queriesSvc_;

      mockScorerSvc.setQ($q);

      mockSettings  = {
        selectedTry:  mockTry,
        searchUrl:    mockSolrUrl,
        createFieldSpec: function() {
          return mockFieldSpec;
        },
      };



      mockFieldSpec = fieldSpecSvc.createFieldSpec('field field1');
    });
  });

  var setupQuerySvc = function(altCaseNo, altQueryResp) {
    var qResp = altQueryResp;
    if (altQueryResp === undefined) {
      qResp = mockFullQueriesResp;
    }

    var caseNo = 2;
    if (altCaseNo !== undefined) {
      caseNo = altCaseNo;
    }

    var url = 'api/cases/' + caseNo + '/queries?bootstrap=true';
    mockSearchSvc.reset();

    $httpBackend.expectGET(url).respond(200, qResp);
    expect(queriesSvc.queries.length === 0);

    queriesSvc.changeSettings(caseNo, mockSettings);
    $httpBackend.flush();

    // search all queries
    var promise = queriesSvc.searchAll();

    // fullfill a search that  occurs after succesful bootstrap
    mockSearchSvc.fulfill(mockResults);
    $rootScope.$apply();
    $httpBackend.verifyNoOutstandingExpectation();
    return promise;
  };

  describe('show rated only', function() {
    var query;
    beforeEach(function() {
      setupQuerySvc();
      query = new queriesSvc.QueryFactory({queryId: 1, query_text: 'test'});
      query.ratings = {1:1, 2:1, 3:1};
    });

    it('toggles show only rated state', function() {
      expect(queriesSvc.showOnlyRated).toEqual(false);
      queriesSvc.toggleShowOnlyRated();
      expect(queriesSvc.showOnlyRated).toEqual(true);
      queriesSvc.reset();
      expect(queriesSvc.showOnlyRated).toEqual(false);
    });
  });

  describe('query factory', function() {
    var query;
    beforeEach(function() {
      setupQuerySvc();
      query = new queriesSvc.QueryFactory({queryId: 1, query_text: 'test'});
    });

    it('knows if it has not been scored', function() {
      expect(query.hasBeenScored).toBe(false);
    });

    it('knows if it has been scored', function() {
      query.setDocs([]);
      query.score().then(function() {
        expect(query.hasBeenScored).toBe(true);
      });
    });

    it('forces rescoring of provided docs', function() {
      var scorer = mockScorerSvc.defaultScorer;
      query = new queriesSvc.QueryFactory({queryId: 1, query_text: 'test', 'doc1': '10'}, true);
      query.docs = [{hasRating: function() {return true;},
                     getRating: function() {return 10;}}];
      query.score();
      expect(scorer.lastDocs[0].getRating()).toEqual(query.docs[0].getRating());
      var rateables = [{hasRating: function() {return true;},
                        getRating: function() {return 1;}}];
      query.scoreOthers(rateables);
      expect(scorer.lastDocs[0].getRating()).toEqual(rateables[0].getRating());
    });

    it('knows if it has not been given docs', function() {
      expect(query.docsSet).toBe(false);
    });

    it('knows when docs have been set', function() {
      query.setDocs([]);
      expect(query.docsSet).toBe(true);
    });

    it('will not score if docs have not been set', function() {
      query.score();
      expect(query.hasBeenScored).toBe(false);
    });
  })

  describe('information about if queries have been scored', function() {
    beforeEach(function() {
      setupQuerySvc();
    });

    it('knows if there are unscored queries', function() {
      expect(queriesSvc.hasUnscoredQueries()).toBe(false);
    });

    it('knows when scoring is completed for all queries', function() {
      queriesSvc.scoreAll().then(function() {
        expect(queriesSvc.hasUnscoredQueries()).toBe(false);
      });
    });

    it('knows if there are unscored queries', function() {
      queriesSvc.queries[0].hasBeenScored = false;
      expect(queriesSvc.hasUnscoredQueries()).toBe(true);
    });

    it('knows how many queries are unscored', function() {
      queriesSvc.queries[0].hasBeenScored = false;
      expect(queriesSvc.unscoredQueryCount()).toBe(1);
    });

    it('knows how many queries have been scored', function() {
      expect(queriesSvc.scoredQueryCount()).toBe(2);
    });
  });

  describe('on bootstrap', function() {
    var versionBeforeSetup = 0;

    var emptyQueryResp = {
      queries: {
        display_order: [],
        queries: {}
      }
    };

    beforeEach(function() {
      versionBeforeSetup = queriesSvc.version();
      setupQuerySvc();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('refreshes when changing try', function() {
      expect(queriesSvc.queries.length === 3);
      expect(queriesSvc.queries['0'].queryText).toBe('symptoms of heart attack');
      expect(queriesSvc.queries['2'].queryText).toBe('prognosis of alzheimers');
    });

    it('changes version when changing try', function() {
      expect(queriesSvc.version()).not.toEqual(versionBeforeSetup);
    });

    it('orders queries by displayOrder', function() {
      var queriesInOrder = queriesSvc.queryArray();
      expect(queriesInOrder[0].queryText).toBe('prognosis of alzheimers');
      expect(queriesInOrder[1].queryText).toBe('symptoms of heart attack');
      expect(queriesInOrder.length).toEqual(2);
    });

    it('updates version if rebootstrap with no queries', function() {
      var versionBefore = queriesSvc.version();
      setupQuerySvc(3, emptyQueryResp);
      expect(queriesSvc.version()).not.toEqual(versionBefore);
    });
  });

  describe('custom bootstrapping', function() {
    it('reports bootstrapped through querySearchReady promise', function() {
      mockSearchSvc.reset();
      var caseNo = 2;
      $httpBackend.expectGET('api/cases/' + caseNo + '/queries?bootstrap=true').respond(200, mockFullQueriesResp);
      var called = 0;
      queriesSvc.changeSettings(caseNo, mockSettings);

      queriesSvc.querySearchReady()
      .then(function() {
        called++;
      });

      expect(called).toBe(0);
      $httpBackend.flush();

      expect(called).toBe(1);

      queriesSvc.searchAll();
      mockSearchSvc.fulfill(mockResults);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('doesnt search for hidden queries', function() {
    });
  });

  describe('adds queries ', function() {
    var newQueryText = 'added by test';
    var newQueryResp = {
      display_order: [2,3,1,0],
      query: {
        'query_text': newQueryText,
        'query_id':    '3',
        'deleted':    'false'
      }
    };

    var versionBeforeAdd = 0;

    beforeEach(function() {
      setupQuerySvc();
      $httpBackend.verifyNoOutstandingExpectation();

      var url = 'api/cases/2/queries';
      $httpBackend.expectPOST(url).respond(200, newQueryResp);

      versionBeforeAdd = queriesSvc.version();

      var q = queriesSvc.createQuery(newQueryText);
      queriesSvc.persistQuery(q);

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('added the query', function() {
      expect(queriesSvc.queries['3'].queryText).toBe(newQueryText);
    });

    it('added the query in front', function() {
      var queriesInOrder = queriesSvc.queryArray();
      expect(queriesInOrder[0].queryText).toBe('prognosis of alzheimers');
      expect(queriesInOrder[1].queryText).toBe(newQueryText);
      expect(queriesInOrder[2].queryText).toBe('symptoms of heart attack');
      expect(queriesInOrder.length).toEqual(3);
    });

    it('changes version on add query', function() {
      expect(queriesSvc.version()).not.toEqual(versionBeforeAdd);
    });

    it('ignores exact duplicate query text', function() {
      versionBeforeAdd = queriesSvc.version();
      $httpBackend.expectPOST('api/cases/2/queries').respond(204);

      var q = queriesSvc.createQuery(newQueryText);
      queriesSvc.persistQuery(q);
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();

      expect(queriesSvc.version()).toEqual(versionBeforeAdd);
    });
  });

  describe('adds queries in bulk', function() {
    var queryTexts    = ['one', 'two', 'three'];
    var bulkResponse  = {
      display_order: [1, 2, 3],
      queries: [
        {
          'query_text': 'one',
          'query_id':    '1',
          'deleted':    'false'
        },
        {
          'query_text': 'two',
          'query_id':    '2',
          'deleted':    'false'
        },
        {
          'query_text': 'three',
          'query_id':    '3',
          'deleted':    'false'
        },
      ]
    };

    var versionBeforeAdd = 0;

    beforeEach(function() {
      setupQuerySvc();
      $httpBackend.verifyNoOutstandingExpectation();

      var url = 'api/bulk/cases/2/queries';
      $httpBackend.expectPOST(url).respond(200, bulkResponse);

      versionBeforeAdd = queriesSvc.version();

      var queries = [];
      angular.forEach(queryTexts, function(text) {
        queries.push(queriesSvc.createQuery(text));
      });

      queriesSvc.persistQueries(queries);

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('adds the queries', function() {
      expect(queriesSvc.queries['1'].queryText).toBe('one');
      expect(queriesSvc.queries['2'].queryText).toBe('two');
      expect(queriesSvc.queries['3'].queryText).toBe('three');
    });

    it('changes version', function() {
      expect(queriesSvc.version()).not.toEqual(versionBeforeAdd);
      expect(queriesSvc.version()).toEqual(versionBeforeAdd + 1);
    });
  });

  describe('deleting queries', function() {
    var versionBeforeDelete = 0;

    beforeEach(function() {
      setupQuerySvc();

      versionBeforeDelete = queriesSvc.version();
      $httpBackend.expectDELETE('api/cases/2/queries/0').respond(200, '');
      queriesSvc.deleteQuery(0);
      $httpBackend.flush();
    });

    it('deletes queries', function() {
      var queriesInOrder = queriesSvc.queryArray();
      expect(queriesInOrder[0].queryText).toBe('prognosis of alzheimers');
      expect(queriesInOrder.length).toEqual(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('changes version on delete query', function() {
      expect(queriesSvc.version()).not.toEqual(versionBeforeDelete);
    });
  });

  describe('moving queries', function() {
    var versionBeforeDelete = 0;

    beforeEach(function() {
      setupQuerySvc();

      versionBeforeDelete = queriesSvc.version();
      $httpBackend.expectPUT('api/cases/2/queries/0').respond(200, '');
      queriesSvc.moveQuery({queryId: 0, caseNo: 2}, {caseNo:1});
      $httpBackend.flush();
    });

    it('moves queries', function() {
      var queriesInOrder = queriesSvc.queryArray();
      expect(queriesInOrder[0].queryText).toBe('prognosis of alzheimers');
      expect(queriesInOrder.length).toEqual(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('changes version on moving query', function() {
      expect(queriesSvc.version()).not.toEqual(versionBeforeDelete);
    });
  });

  it('provides working case no', function() {
    $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    queriesSvc.changeSettings(2, mockSettings);
    $httpBackend.flush();
    expect(queriesSvc.getCaseNo()).toBe(2);
  });

  it('loading state reported' , function() {
    $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    queriesSvc.changeSettings(2, mockSettings);
    $httpBackend.flush();
    queriesSvc.searchAll();

    var testQuery = queriesSvc.queries['0'];
    expect(testQuery.state()).toBe('loading');

    mockSearchSvc.fulfill(mockResults);
    $rootScope.$apply();

    expect(testQuery.state()).toBe('loaded');

    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('no results state reported', function() {
    $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    queriesSvc.changeSettings(2, mockSettings);
    $httpBackend.flush();
    queriesSvc.searchAll();

    $rootScope.$apply();

    var testQuery = queriesSvc.queries['0'];
    expect(testQuery.state()).toBe('loading');

    mockSearchSvc.fulfill({response: {docs: []}});
    $rootScope.$apply();

    expect(testQuery.state()).toBe('noResults');

    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('no results state clears', function() {
    $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    queriesSvc.changeSettings(2, mockSettings);
    $httpBackend.flush();
    queriesSvc.searchAll();
    $rootScope.$apply();

    var testQuery = queriesSvc.queries['0'];
    expect(testQuery.state()).toBe('loading');

    mockSearchSvc.fulfill({response: {docs: []}});
    $rootScope.$apply();

    expect(testQuery.state()).toBe('noResults');
    expect(testQuery.state()).toBe('noResults');

    testQuery.search();
    mockSearchSvc.fulfill(mockResults);
    $rootScope.$apply();

    expect(testQuery.state()).toBe('loaded');
  });

  it('stores docs after succesful search', function() {
    setupQuerySvc();

    var testQuery = queriesSvc.queries['0'];
    expect(testQuery.docs.length).toEqual(2);
    expect(testQuery.docs[0].id).toBe('doc1');
    expect(testQuery.docs[1].id).toBe('doc2');

    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('rates queries after persisting', function() {
    var newQueryResp = {
      display_order: [2,3,1,0],
      query: {
        'query_text': 'search text',
        'query_id':    '3',
        'deleted':    'false'
      }
    };
    setupQuerySvc();
    mockSearchSvc.reset();
    var newQ = queriesSvc.createQuery('foo');
    expect(newQ.persisted()).toBeFalsy();
    newQ.search();
    mockSearchSvc.fulfill(mockResults);
    $httpBackend.expectPOST('api/cases/2/queries').respond(200, newQueryResp);
    expect(newQ.diff).toBe(null);
    queriesSvc.persistQuery(newQ);
    $httpBackend.flush();

    $httpBackend.expectPUT('api/cases/2/queries/3/ratings').respond(200, {doc_id: 'doc1', rating: 10});
    newQ.docs[0].rate('10');
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('reports browse url', function() {
    setupQuerySvc();

    var testQuery = queriesSvc.queries['0'];
    expect(testQuery.browseUrl().indexOf(mockSolrUrl))
    .toEqual(0);
  });

  it('calculates avg score', function() {
    setupQuerySvc();
    queriesSvc.scoreAll().then(function(scoreInfo) {
      expect(scoreInfo.score).toBeGreaterThan(0);
    });
  });

  it('scores scorables', function() {
    setupQuerySvc();
    var Scorable = function() {
      this.score = function() {
        var deferred = $q.defer();
        deferred.resolve({
            score:            5,
            maxScore:         5,
            allRated:         true,
            backgroundColor:  ''
        });
        return deferred.promise;
      };
    };

    var scoreables = [];
    for (var i = 0; i < 10; i++) {
      scoreables.push(new Scorable());
    }
    queriesSvc.scoreAll(scoreables).then(function(scoreInfo) {
      expect(scoreInfo.score).toBeGreaterThan(0);
    });
  });

  it('applies ratings to docs', function() {
    setupQuerySvc();
    var testQuery = queriesSvc.queries['0'];

    expect(testQuery.docs.length).toEqual(2);
    expect(testQuery.docs[0].getRating()).toBe(5);
    expect(testQuery.docs[0].hasRating()).toBe(true);
    expect(testQuery.docs[1].getRating()).toBe(9);
    expect(testQuery.docs[1].hasRating()).toBe(true);

    $httpBackend.verifyNoOutstandingExpectation();
  });

  describe('rating docs', function() {
    var testQuery = null;
    var testDoc = null;
    var versionBeforeRate = 0;
    beforeEach(function() {
      setupQuerySvc();

      testQuery = queriesSvc.queries['0'];
      testDoc = testQuery.docs[0];
      $httpBackend.expectPUT('api/cases/2/queries/' + testQuery.queryId + '/ratings').respond(200, {doc_id: testDoc.id, rating: 10});
      versionBeforeRate = queriesSvc.version();
      testDoc.rate(10);
      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('rating docs updates version', function() {
      expect(versionBeforeRate).not.toBe(queriesSvc.version());
    });
  });

  it('generated docs rates correct case,query,docid after case change', function() {
    setupQuerySvc();

    $httpBackend.expectGET('api/cases/3/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    var newMockTry = angular.copy(mockTry);
    newMockTry.tryNo = 4;
    var mockNewSettings = {selectedTry: newMockTry,
      createFieldSpec: function() {
        return mockFieldSpec;
      },
    searchUrl: mockSolrUrl};
    queriesSvc.changeSettings(3, mockNewSettings);
    $httpBackend.flush();
    queriesSvc.searchAll();
    mockSearchSvc.fulfill(mockResults);
    $rootScope.$apply();

    var testQuery = queriesSvc.queries['0'];
    var testDoc = testQuery.docs[0];
    $httpBackend.expectPUT('api/cases/3/queries/' + testQuery.queryId + '/ratings').respond(200, {doc_id: testDoc.id, rating: 10});
    //$httpBackend.expectPUT('api/cases/3/queries/' + testQuery.queryId + '/ratings/' + testDoc.id).respond(200, '');
    testDoc.rate(10);
    testQuery.score().then(function(score) {
      expect(score.score).toBeGreaterThan(0);
    });

    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  });

  it('reports state as error on error response', function() {
    $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    queriesSvc.changeSettings(2, mockSettings);
    $httpBackend.flush();
    queriesSvc.searchAll();

    var testQuery = queriesSvc.queries['0'];
    expect(testQuery.state()).toBe('loading');

    mockSearchSvc.fail();
    $rootScope.$apply();

    expect(testQuery.docs.length).toEqual(0);
    expect(testQuery.linkUrl).toContain(mockSolrUrl);
    expect(testQuery.state()).toBe('error');
    expect(testQuery.state()).toBe('error');
  });

    /** Notes Testing **/
  describe('- Notes Tests: ', function() {
    var mockNotes = { notes: 'lorem ipsum lots of toast', information_need:'this is my need' };
    var testQuery;

    beforeEach(function() {
      setupQuerySvc();
      testQuery = queriesSvc.queries['0'];
    });

    it('Fetching notes from the backend', function() {
      $httpBackend.expectGET('api/cases/2/queries/' + testQuery.queryId + '/notes')
        .respond(200, mockNotes);

      testQuery.fetchNotes()
        .then(function() {
          expect(testQuery.notes).toEqual(mockNotes.notes);
          expect(testQuery.informationNeed).toEqual(mockNotes.information_need);
        });

      $httpBackend.flush();
    });

    it('Saving notes to the backend', function() {
      var testNewNotes  = 'more notes! I HAS NOTES!';
      mockNotes.notes   = testNewNotes;

      $httpBackend.expectPUT('api/cases/2/queries/' + testQuery.queryId + '/notes')
        .respond(200, mockNotes);

      testQuery.saveNotes(testNewNotes)
        .then(function() {
          expect(testQuery.notes).toEqual(testNewNotes);
        });

      $httpBackend.flush();
    });
  });

  it('best docs have only doc ids', function() {
    setupQuerySvc();
    var testQuery = queriesSvc.queries['0'];
    var bestDocs = testQuery.ratingsStore.bestDocs(5);
    expect(bestDocs.length).toBe(2);
    expect(bestDocs[0].id).toEqual('doc2');
    expect(bestDocs[1].id).toEqual('doc1');
  });

  describe('- Max Score Tests: ', function() {
    var explain1 = {'match':true,'value':1.0,'description':'weight(text:foo)'};
    var explain2 = {'match':true,'value':2.0,'description':'weight(text:foo)'};
    var mockResults1 = {
      response: {
        numFound: 2,
        docs : [
          {id: 'doc1', field1: 'doc1field1val', field2: 'doc1field2val',
           origin: function() {return this;}, highlight: function() {return null;}, explain: function() {return explain1;}},
          {id: 'doc2', field1: 'doc2field1val', field2: 'doc2field2val',
           origin: function() {return this;}, highlight: function() {return null;}, explain: function() {return explain2;}}
        ]
      }
    };

    var explain2_1 = {'match':true,'value':0.5,'description':'weight(text:foo)'};
    var explain2_2 = {'match':true,'value':1.0,'description':'weight(text:foo)'};
    var mockResults2 = {
      response: {
        numFound: 2,
        docs : [
          {id: 'doc1', field1: 'doc1field1val', field2: 'doc1field2val',
           origin: function() {return this;}, highlight: function() {return null;}, explain: function() {return explain2_1;}},
          {id: 'doc2', field1: 'doc2field1val', field2: 'doc2field2val',
           origin: function() {return this;}, highlight: function() {return null;}, explain: function() {return explain2_2;}}
        ]
      }
    };

    it('calculates max doc score', function() {
      $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
      queriesSvc.changeSettings(2, mockSettings);
      $httpBackend.flush();
      queriesSvc.searchAll();

      mockSearchSvc.fulfill(mockResults1);
      $rootScope.$apply();

      var q = queriesSvc.queries[0];
      expect(q.maxDocScore()).toEqual(2.0);
    });

    it('resets max doc score', function() {
      $httpBackend.expectGET('api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
      queriesSvc.changeSettings(2, mockSettings);
      $httpBackend.flush();
      queriesSvc.searchAll();
      mockSearchSvc.fulfill(mockResults1);

      $rootScope.$apply();

      var q = queriesSvc.queries[0];
      expect(q.maxDocScore()).toEqual(2.0);

      // search and return other results, max score should now be less
      q.search();
      mockSearchSvc.fulfill(mockResults2);

      $rootScope.$apply();
      expect(q.maxDocScore()).toEqual(1.0);
    });
  });

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });
});
