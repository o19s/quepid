'use strict';

describe('Service: scorerSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var mockScorersResp = {
    'user_scorers': [
      {
        'scorer_id': 1,
        'name':     'Scorer 1',
        'code':     'pass()',
        'owner_id': 1,
        'owned':    true,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      },
      {
        'scorer_id': 2,
        'name':     'Scorer 2',
        'code':     'pass()',
        'owner_id': 1,
        'owned':    true,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      },
      {
        'scorer_id': 3,
        'name':     'A Scorer 3',
        'code':     'pass()',
        'owner_id': 2,
        'owned':    false,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      }
    ]
  };

  var mockScorer = {
    'scorerId': 1,
    'name':       'Scorer 1',
    'code':       'pass()',
    'owner_id':   1,
    'scale':      [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
    'queryId':    null,
  };
  var mockScorerResp = {
    'scorer_id': 1,
    'name':       'Scorer 1',
    'code':       'pass()',
    'owner_id':   1,
    'scale':      [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
    'queryId':    null,
  };

  var $httpBackend, scorerSvc;

  // instantiate service
  beforeEach(function() {
    inject(function (_scorerSvc_, $injector) {
      scorerSvc = _scorerSvc_;
      $httpBackend = $injector.get('$httpBackend');
    });
  });

  it('gets a list of scorers', function() {
    var url = 'api/scorers';
    $httpBackend.expectGET(url).respond(200, mockScorersResp);
    scorerSvc.list()
      .then(function() {
        expect(scorerSvc.scorers.length).toBe(3);
        expect(scorerSvc.scorers[2].name).toBe('A Scorer 3');
      });
    $httpBackend.flush();
  });

  it('creates a scorer', function() {
    var url = 'api/scorers';
    $httpBackend.expectPOST(url).respond(201, mockScorerResp);

    scorerSvc.create(mockScorer)
      .then(function(response) {
        expect(scorerSvc.scorers.length).toBe(1);
        var expectedScorer = scorerSvc.constructFromData(mockScorerResp);
        expect(angular.equals(response, expectedScorer)).toBe(true);
      });
    $httpBackend.flush();
  });

  it('edits a scorer', function() {
    var editedScorer  = mockScorer;
    var editedScorerResp = mockScorerResp;
    editedScorer.name = 'Edited Scorer';
    editedScorerResp.name = 'Edited Scorer';

    var url = 'api/scorers/' + mockScorer.scorerId;
    $httpBackend.expectPUT(url).respond(200, editedScorerResp);

    scorerSvc.edit(editedScorer)
      .then(function(response) {
        expect(response.name).toEqual('Edited Scorer');
      });
    $httpBackend.flush();
  });

  it('fetches a scorer', function() {
    var url = 'api/scorers/' + mockScorer.scorerId;
    $httpBackend.expectGET(url).respond(200, mockScorerResp);

    scorerSvc.get(mockScorer.scorerId)
      .then(function(response) {
        expect(response.code).toEqual(mockScorer.code);
      });
    $httpBackend.flush();
  });

  it('updates the cache when editing a scorer', function() {
    var url = 'api/scorers/' + mockScorer.scorerId;
    mockScorer.name = 'New Name';
    mockScorerResp.name = 'New Name';
    $httpBackend.expectPUT(url).respond(200, mockScorerResp);

    scorerSvc.edit(mockScorer).
      then(function() {
        scorerSvc.get(mockScorer.scorerId)
          .then(function(response) {
            // this should fire without a new get request
            expect(response.name).toEqual('New Name');
          });
        });
    $httpBackend.flush();
  });

  it('bootstraps and goes nuts', function() {
    var scorerDefault = scorerSvc.get();
    expect(scorerDefault).not.toBe(null);
  });

  describe('bootstrap', function() {
    beforeEach(function() {
      scorerSvc.clearScorer();
    });

    var mockResponse = {
      default: '',
      scorers: []
    };

    var caseNo = 1;

    it('sets the default to the default scorer if the API returns an empty default', function() {
      var url = 'api/cases/' + caseNo + '/scorers';
      $httpBackend.expectGET(url).respond(200, mockResponse);

      scorerSvc.bootstrap(caseNo);

      $httpBackend.flush();
      expect(scorerSvc.defaultScorer).not.toBe(null);
    });
  });
});
