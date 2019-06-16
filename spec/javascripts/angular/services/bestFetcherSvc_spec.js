'use strict';
/*global urlContainsParams*/
describe('Service: bestFetcherSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var expectedParams = {
    q: [encodeURIComponent('id:(doc1 OR doc2 OR doc3 OR doc4 OR doc5 OR doc6 OR doc7 OR doc8 OR doc9 OR doc10 OR doc11 OR doc12)')]
  };

  var mockTry = {
    args: {
      q: ['#$query##'],
    },
    tryNo: 2,
    searchUrl: mockSolrUrl
  };

  var mockFieldSpec = null;

  var mockFullQueriesResp = {
    displayOrder: [2,1,0],
    queries: [
      {
        'arrangedAt':   '3681400536',
        'arrangedNext': '4294967295',
        'deleted':      'false',
        'queryId':      '0',
        'query_text':   'symptoms of heart attack',
        'ratings':      {
          'doc1':  '10',
          'doc2':  '9',
          'doc3':  '8',
          'doc4':  '7',
          'doc5':  '6',
          'doc6':  '5',
          'doc7':  '4',
          'doc8':  '3',
          'doc9':  '2',
          'doc10': '2',
          'doc11': '1',
          'doc12': '1'
        }
      },
      {
        'arrangedAt':   '3067833780',
        'arrangedNext': '3681400536',
        'deleted':      'true',
        'queryId':      '1',
        'query_text':   'how is kidney cancer diagnosed'
      },
      {
        'arrangedAt':   '0',
        'arrangedNext': '613566756',
        'deleted':      'false',
        'queryId':      '2',
        'query_text':   'prognosis of alzheimers',
        'ratings':      {
          'l_31284':  '10',
          'doc1':     '1',
          'doc2':     '10'
        }
      }
    ]
  };


  var mockSolrResp = {
    response: {
      numFound: 10,
      docs : [
        {id: 'doc1', field1: 'title1'},
        {id: 'doc2', field1: 'title2'},
        {id: 'doc3', field1: 'title3'},
        {id: 'doc4', field1: 'title4'},
        {id: 'doc5', field1: 'title5'},
        {id: 'doc6', field1: 'title6'},
        {id: 'doc7', field1: 'title7'},
        {id: 'doc8', field1: 'title8'},
        {id: 'doc9', field1: 'title9'},
        {id: 'doc10', field1: 'title10'}
      ]
    }
  };
  /*global addExplain*/
  addExplain(mockSolrResp);

  var mockSolrRespMissingDoc2 = {
    response: {
      numFound: 10,
      docs : [
        {id: 'doc1', field1: 'title1'},
        {id: 'doc3', field1: 'title3'},
        {id: 'doc4', field1: 'title4'},
        {id: 'doc5', field1: 'title5'},
        {id: 'doc6', field1: 'title6'},
        {id: 'doc7', field1: 'title7'},
        {id: 'doc8', field1: 'title8'},
        {id: 'doc9', field1: 'title9'},
        {id: 'doc10', field1: 'title10'}
      ]
    }
  };
  addExplain(mockSolrRespMissingDoc2);

  // instantiate service
  var bestFetcherSvc;
  var queriesSvc;
  var mockSettings;
  var $httpBackend;
  beforeEach(inject(function ($injector, _bestFetcherSvc_, _queriesSvc_, _fieldSpecSvc_) {
    bestFetcherSvc = _bestFetcherSvc_;
    queriesSvc = _queriesSvc_;
    mockFieldSpec = _fieldSpecSvc_.createFieldSpec('field field1');
    $httpBackend = $injector.get('$httpBackend');

    $httpBackend.expectGET('/api/cases/2/scorers').respond(200, {});
    // bootstrap three queries (see above) into queriesSvc
    $httpBackend.expectGET('/api/cases/2/queries?bootstrap=true').respond(200, mockFullQueriesResp);
    mockSettings = {
      selectedTry: mockTry,
      createFieldSpec: function() {
        return mockFieldSpec;
      },
      searchUrl: mockSolrUrl
    };
    queriesSvc.changeSettings(2, mockSettings);
    $httpBackend.flush();
    $httpBackend.expectJSONP(expectedSolrUrl())
                .respond(200,mockResults);
    $httpBackend.expectJSONP(expectedSolrUrl())
                .respond(200,mockResults);
    expect(queriesSvc.queries.length === 0);
    queriesSvc.searchAll();
    $httpBackend.flush();
    $httpBackend.verifyNoOutstandingExpectation();
  }));

  // it('fetches best docs', function () {
  //   var query = queriesSvc.queries[0];
  //   var bestFinder = bestFetcherSvc.createBestFetcher(query.ratingsStore);
  //   $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
  //               .respond(200, mockSolrResp);
  //   bestFinder.fetch(mockSettings);
  //   $httpBackend.flush();
  //   $httpBackend.verifyNoOutstandingExpectation();
  // });

  // it('produces doc with correct sort & ratings', function() {
  //   var query = queriesSvc.queries[0];
  //   var bestFinder = bestFetcherSvc.createBestFetcher(query.ratingsStore);
  //   $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
  //               .respond(200, mockSolrResp);
  //   bestFinder.fetch(mockSettings);
  //   $httpBackend.flush();
  //   $httpBackend.verifyNoOutstandingExpectation();

  //   expect(bestFinder.docs[0].getRating()).toEqual(10);
  //   expect(bestFinder.docs[0].id).toBe('doc1');
  //   expect(bestFinder.docs[1].getRating()).toEqual(9);
  //   expect(bestFinder.docs[1].id).toBe('doc2');
  //   expect(bestFinder.docs[2].getRating()).toEqual(8);
  //   expect(bestFinder.docs[2].id).toBe('doc3');
  //   expect(bestFinder.docs[3].getRating()).toEqual(7);
  //   expect(bestFinder.docs[3].id).toBe('doc4');
  //   expect(bestFinder.docs[4].getRating()).toEqual(6);
  //   expect(bestFinder.docs[4].id).toBe('doc5');
  //   expect(bestFinder.docs[5].getRating()).toEqual(5);
  //   expect(bestFinder.docs[5].id).toBe('doc6');
  //   expect(bestFinder.docs[6].getRating()).toEqual(4);
  //   expect(bestFinder.docs[6].id).toBe('doc7');
  //   expect(bestFinder.docs[7].getRating()).toEqual(3);
  //   expect(bestFinder.docs[7].id).toBe('doc8');
  //   expect(bestFinder.docs[8].getRating()).toEqual(2);
  //   expect(bestFinder.docs[8].id).toBe('doc9');
  //   expect(bestFinder.docs[9].getRating()).toEqual(2);
  //   expect(bestFinder.docs[9].id).toBe('doc10');
  //   expect(bestFinder.docs.length).toBe(12);
  // });

  // it('produces ratable docs', function () {
  //   var query = queriesSvc.queries[0];
  //   var bestFinder = bestFetcherSvc.createBestFetcher(query.ratingsStore);
  //   $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
  //               .respond(200, mockSolrResp);
  //   bestFinder.fetch(mockSettings);
  //   $httpBackend.flush();
  //   $httpBackend.verifyNoOutstandingExpectation();

  //   var rateableSolrDoc = bestFinder.docs[0];
  //   $httpBackend.expectPUT('/api/cases/2/queries/0/ratings/doc1').respond(200, {});
  //   rateableSolrDoc.rate(5);
  //   $httpBackend.flush();
  //   expect(query.ratingsStore.getRating('doc1')).toBe(5);
  //   $httpBackend.verifyNoOutstandingExpectation();
  // });

  // it('fills in a missing doc when solr doesnt return one', function() {
  //   var query = queriesSvc.queries[0];
  //   var bestFinder = bestFetcherSvc.createBestFetcher(query.ratingsStore);
  //   $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
  //               .respond(200, mockSolrRespMissingDoc2);
  //   bestFinder.fetch(mockSettings);
  //   $httpBackend.flush();
  //   $httpBackend.verifyNoOutstandingExpectation();
  //   expect(bestFinder.docs.length).toBe(12);
  //   expect(bestFinder.docs[0].getRating()).toEqual(10);
  //   expect(bestFinder.docs[0].id).toBe('doc1');
  //   expect(bestFinder.docs[1].getRating()).toEqual(9);
  //   expect(bestFinder.docs[1].id).toBe('doc2');
  //   expect(bestFinder.docs[2].getRating()).toEqual(8);
  //   expect(bestFinder.docs[2].id).toBe('doc3');
  //   expect(bestFinder.docs[3].getRating()).toEqual(7);
  //   expect(bestFinder.docs[3].id).toBe('doc4');
  //   expect(bestFinder.docs[4].getRating()).toEqual(6);
  //   expect(bestFinder.docs[4].id).toBe('doc5');
  //   expect(bestFinder.docs[5].getRating()).toEqual(5);
  //   expect(bestFinder.docs[5].id).toBe('doc6');
  //   expect(bestFinder.docs[6].getRating()).toEqual(4);
  //   expect(bestFinder.docs[6].id).toBe('doc7');
  //   expect(bestFinder.docs[7].getRating()).toEqual(3);
  //   expect(bestFinder.docs[7].id).toBe('doc8');
  //   expect(bestFinder.docs[8].getRating()).toEqual(2);
  //   expect(bestFinder.docs[8].id).toBe('doc9');
  //   expect(bestFinder.docs[9].getRating()).toEqual(2);
  //   expect(bestFinder.docs[9].id).toBe('doc10');
  // });

  // it('makes placeholder docs that are rateable', function() {
  //   var query = queriesSvc.queries[0];
  //   var bestFinder = bestFetcherSvc.createBestFetcher(query.ratingsStore);
  //   $httpBackend.expectJSONP(urlContainsParams(mockSolrUrl, expectedParams))
  //               .respond(200, mockSolrRespMissingDoc2);
  //   bestFinder.fetch(mockSettings);
  //   $httpBackend.flush();
  //   $httpBackend.verifyNoOutstandingExpectation();

  //   var rateableSolrDoc = bestFinder.docs[1];
  //   $httpBackend.expectPUT('/api/cases/2/queries/0/ratings/doc2').respond(200, {});
  //   rateableSolrDoc.rate(5);
  //   $httpBackend.flush();
  //   expect(query.ratingsStore.getRating('doc2')).toBe(5);
  //   $httpBackend.verifyNoOutstandingExpectation();
  // });

});
