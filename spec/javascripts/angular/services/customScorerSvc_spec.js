'use strict';

describe('Service: customScorerSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var mockScorers = {
    'user_scorers': [
      {
        'scorerId': 1,
        'name':     'Scorer 1',
        'code':     'pass()',
        'owner_id': 1,
        'owned':    true,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      },
      {
        'scorerId': 2,
        'name':     'Scorer 2',
        'code':     'pass()',
        'owner_id': 1,
        'owned':    true,
        'scale':    [1, 2, 3, 4, 5, 6 , 7, 8, 9, 10],
      },
      {
        'scorerId': 3,
        'name':     'Scorer 3',
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
    'queryTest':  false,
    'queryId':    null,
  };

  var $httpBackend, customScorerSvc;

  // instantiate service
  beforeEach(function() {
    inject(function (_customScorerSvc_, $injector) {
      customScorerSvc = _customScorerSvc_;
      $httpBackend = $injector.get('$httpBackend');
    });
  });

  it('gets a list of scorers', function() {
    var url = '/api/scorers';
    $httpBackend.expectGET(url).respond(200, mockScorers);
    customScorerSvc.list()
      .then(function() {
        expect(customScorerSvc.scorers.length).toBe(3);
      });
    $httpBackend.flush();
  });

  it('creates a scorer', function() {
    var url = '/api/scorers';
    $httpBackend.expectPOST(url).respond(201, mockScorer);

    customScorerSvc.create(mockScorer)
      .then(function(response) {
        expect(customScorerSvc.scorers.length).toBe(1);
        var expectedScorer = customScorerSvc.constructFromData(mockScorer);
        expect(angular.equals(response, expectedScorer)).toBe(true);
      });
    $httpBackend.flush();
  });

  it('edits a scorer', function() {
    var editedScorer  = mockScorer;
    editedScorer.name = 'Edited Scorer';

    var url = '/api/scorers/' + mockScorer.scorerId;
    $httpBackend.expectPUT(url).respond(200, editedScorer);

    customScorerSvc.edit(editedScorer)
      .then(function(response) {
        expect(response.name).toEqual('Edited Scorer');
      });
    $httpBackend.flush();
  });

  it('fetches a scorer', function() {
    var url = '/api/scorers/' + mockScorer.scorerId;
    $httpBackend.expectGET(url).respond(200, mockScorer);

    customScorerSvc.get(mockScorer.scorerId)
      .then(function(response) {
        expect(response.code).toEqual(mockScorer.code);
      });
    $httpBackend.flush();
  });

  it('updates the cache when editing a scorer', function() {
    var url = '/api/scorers/' + mockScorer.scorerId;
    mockScorer.name = 'New Name';
    $httpBackend.expectPUT(url).respond(200, mockScorer);

    customScorerSvc.edit(mockScorer).
      then(function() {
        customScorerSvc.get(mockScorer.scorerId)
          .then(function(response) {
            // this should fire without a new get request
            expect(response.name).toEqual('New Name');
          });
        });
    $httpBackend.flush();
  });

  it('bootstraps and goes nuts', function() {
    var scorerDefault = customScorerSvc.get();
    expect(scorerDefault).not.toBe(null);
  });

  describe('bootstrap', function() {
    beforeEach(function() {
      customScorerSvc.clearScorer();
    });

    var mockResponse = {
      default: '',
      scorers: []
    };

    var caseNo = 1;

    it('sets the default to the default scorer if the API returns an empty default', function() {
      var url = '/api/cases/' + caseNo + '/scorers';
      $httpBackend.expectGET(url).respond(200, mockResponse);

      customScorerSvc.bootstrap(caseNo);

      $httpBackend.flush();
      expect(customScorerSvc.defaultScorer).not.toBe(null);
    });
  });
});



