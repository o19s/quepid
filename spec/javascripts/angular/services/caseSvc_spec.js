'use strict';

describe('Service: caseSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  var mockCase1 = {
    'case_id':   1,
    'case_name': 'test case',
    'lastTry':  4,
    'owned':    true
  };

  var mockCases = {
    all_cases: [
      mockCase1,
      {
        'case_id':  2,
        'case_name': 'test case 2',
        'lastTry':  3,
        'owned':    true
      },
      {
        'case_id':   3,
        'case_name': 'test case 3',
        'lastTry':  0,
        'owned':    false
      },
      {
        'case_id':   4,
        'case_name': 'test case 4',
        'lastTry':  0,
        'owned':    false
      }
    ]
  };

  var $httpBackend = null;

  var mockCaseTryNavSvc = {
    notFoundCalled: 0,
    notFound: function() {
      this.notFoundCalled++;
    },
    navigateTo: function() {
    }
  };

  var expectToRefetchCases = function() {
    var mockReturnedCases = {
      all_cases: []
    };
    $httpBackend.expectGET('api/cases').respond(200, mockReturnedCases);
    $httpBackend.expectGET('api/dropdown/cases').respond(200, mockReturnedCases);
  };

  // instantiate service
  var caseSvc;
  beforeEach(function() {
    module(function($provide) {
      $provide.value('caseTryNavSvc', mockCaseTryNavSvc);
    });
    inject(function (_caseSvc_, $injector) {
      caseSvc = _caseSvc_;
      $httpBackend = $injector.get('$httpBackend');
    });
  });

  it('tests get cases', function () {
    $httpBackend.expectGET('api/cases').respond(200, mockCases);
    $httpBackend.expectGET('api/dropdown/cases').respond(200, mockCases);

    caseSvc.uponBeingBootstrapped().
      then(function() {
        expect(caseSvc.allCases.length).toBe(4);
      });

    $httpBackend.flush();
  });


  describe('tests after bootstrap', function() {
    beforeEach(function() {
      $httpBackend.expectGET('api/cases').respond(200, mockCases);
      $httpBackend.expectGET('api/dropdown/cases').respond(200, mockCases);



      caseSvc.uponBeingBootstrapped().
        then(function() {
          expect(caseSvc.allCases.length).toBe(4);
        });

      $httpBackend.flush();
    });

    var mockNewTry = {
      lastTry: 1,
      caseNo: 5,
      caseName: 'new case'
    };

    var mockNewTryResp = {
      last_try_number: 1,
      case_id: 5,
      case_name: 'new case'
    };



    it('selects a shared case', function() {
      caseSvc.selectCase(3);
      var selectedCase = caseSvc.getSelectedCase();
      expect(selectedCase.caseName).toBe('test case 3');

      caseSvc.selectCase(4);
      var selectedCase = caseSvc.getSelectedCase();
      expect(selectedCase.caseName).toBe('test case 4');
    });

    it('creates cases with expected name', function() {
      $httpBackend.expectPOST('api/cases').respond(201, mockNewTryResp);
      caseSvc.createCase();
      $httpBackend.flush();
      caseSvc.selectCase(mockNewTry.caseNo);
      var newCase = caseSvc.getSelectedCase();
      expect(newCase.caseName).toBe(mockNewTry.caseName);
    });

    it('renames case with expected name', function() {
      $httpBackend.expectPOST('api/cases').respond(201, mockNewTryResp);
      caseSvc.createCase();
      $httpBackend.flush();
      caseSvc.selectCase(mockNewTry.caseNo);
      var newCase = caseSvc.getSelectedCase();
      expect(newCase.caseName).toBe(mockNewTry.caseName);

      var newName = 'blah';
      $httpBackend.expectPUT('api/cases/' + newCase.caseNo).respond(201, {});
      caseSvc.renameCase(newCase, newName);
      $httpBackend.flush();
      var sameCase = caseSvc.getSelectedCase();
      expect(sameCase.caseName).toBe(newName);
      expect(newCase.caseName).toBe(newName);

      caseSvc.selectCase(newCase.caseNo);
      var sameCaseSelected = caseSvc.getSelectedCase();
      expect(sameCaseSelected.caseName).toBe(newName);

    });

    it('creates cases with specified name', function() {
      var name = 'El Case-o-dilla';
      $httpBackend.expectPOST('api/cases', function(content) {
        var addCaseParsed = angular.fromJson(content);
        return addCaseParsed.case_name === name;
      }
      ).respond(201, mockNewTryResp);
      caseSvc.createCase(name);
      $httpBackend.flush();
      caseSvc.selectCase(mockNewTry.caseNo);
      var newCase = caseSvc.getSelectedCase();
      expect(newCase.caseName).toBe(mockNewTry.caseName);

    });

    it('creates cases with passed in queries', function() {
      var queries = {'queries': {'5': {'query_text': 'foo'}}, 'displayOrder': ['5']};
      $httpBackend.expectPOST('api/cases', function(content) {
        var addCaseParsed = angular.fromJson(content);
        return addCaseParsed.queries.queries['5']['query_text'] === 'foo';
      }
    ).respond(201, mockNewTryResp);
      caseSvc.createCase(undefined, queries);
      $httpBackend.flush();
      caseSvc.selectCase(mockNewTry.caseNo);
      var newCase = caseSvc.getSelectedCase();
      expect(newCase.caseName).toBe(mockNewTry.caseName);
    });

    it('creates cases with passed in tries', function() {
      var tries = [{searchUrl: 'foo'}];
      $httpBackend.expectPOST('api/cases', function(content) {
        var addCaseParsed = angular.fromJson(content);
        return addCaseParsed.tries[0].searchUrl === 'foo';
      }
      ).respond(201, mockNewTryResp);
      caseSvc.createCase(undefined, undefined, tries);
      $httpBackend.flush();
      caseSvc.selectCase(mockNewTry.caseNo);
      var newCase = caseSvc.getSelectedCase();
      expect(newCase.caseName).toBe(mockNewTry.caseName);
    });

    it('gets a case by number', function() {
      $httpBackend.expectGET('api/cases/1').respond(200, mockCase1);
      caseSvc.get(1,false).then(function(acase) {
        expect(acase.caseName).toEqual('test case');
      });
      $httpBackend.flush();
    });


    it('deletes a case', function() {
      $httpBackend.expectGET('api/cases/1').respond(200, mockCase1);
      $httpBackend.expectDELETE('api/cases/1').respond(200, '');
      expectToRefetchCases();

      caseSvc.get(1,false).then(function(acase) {
        caseSvc.deleteCase(acase);
      });

      $httpBackend.flush();

      var caseFound = false;
      angular.forEach(caseSvc.allCases, function(aCase) {
        if(aCase.caseNo === 1){
          caseFound = true;
        }
      });

      expect(caseFound).toEqual(false);
    });

    it('deletes and calls promise', function(){
      $httpBackend.expectGET('api/cases/1').respond(200, mockCase1);
      $httpBackend.expectDELETE('api/cases/1').respond(200, '');
      expectToRefetchCases();
      var called = false;
      caseSvc.get(1,false).then(function(acase) {
        caseSvc.deleteCase(acase).then( function() {
          called = true;
        });
      });
      $httpBackend.flush();
      expect(called).toEqual(true);
    });

    it('deletes currently selected case, calls promise', function(){
      caseSvc.selectCase(1);
      expect(caseSvc.getSelectedCase().caseNo).toEqual(1);
      $httpBackend.expectGET('api/cases/1').respond(200, mockCase1);
      $httpBackend.expectDELETE('api/cases/1').respond(200, '');
      expectToRefetchCases();
      caseSvc.get(1,false).then(function(acase) {
        caseSvc.deleteCase(acase);
      });
      $httpBackend.flush();
      expect(caseSvc.getSelectedCase()).toEqual(null);
    });

    it('deletes currently selected case, calls promise', function(){
      caseSvc.selectCase(2);
      expect(caseSvc.getSelectedCase().caseNo).toEqual(2);
      $httpBackend.expectGET('api/cases/1').respond(200, mockCase1);
      $httpBackend.expectDELETE('api/cases/1').respond(200, '');
      expectToRefetchCases();
      caseSvc.get(1,false).then(function(acase) {
        caseSvc.deleteCase(acase);
      });
      $httpBackend.flush();
      expect(caseSvc.getSelectedCase().caseNo).toEqual(2);
    });

    var archivedCasesAPIResponse = {
      all_cases: [
        {
          'case_id':   6,
          'case_name': 'archived',
          'last_try_number':  4
        }
      ]
    };

    it('add back archived case', function() {
      $httpBackend.expectGET('api/cases?archived=true').respond(200, archivedCasesAPIResponse);
      var called = 0;
      caseSvc.fetchArchived()
      .then(function() {
        called++;
        expect(caseSvc.archived.length).toBe(1);
        expect(caseSvc.archived[0].caseNo).toBe(6);
        expect(caseSvc.archived[0].caseName).toBe('archived');
        expect(caseSvc.archived[0].lastTry).toBe(4);
      });

      $httpBackend.flush();
      expect(called).toBe(1);

      var archivedCaseNo = caseSvc.archived[0].caseNo;
      $httpBackend.expectPUT('api/cases/' + archivedCaseNo).respond(200, archivedCasesAPIResponse.all_cases[0]);

      var casesBefore = caseSvc.allCases.length;
      caseSvc.unarchiveCase(caseSvc.archived[0]).then(function() {
        called++;
        expect(caseSvc.archived.length).toBe(0);
        expect(caseSvc.allCases.length).toBe(casesBefore + 1);
        caseSvc.selectCase(archivedCaseNo);
        expect(caseSvc.getSelectedCase().caseNo).toEqual(archivedCaseNo);
        expect(caseSvc.getSelectedCase().caseName).toEqual('archived');
      });
      $httpBackend.flush();
      expect(called).toBe(2);
    });

    it('refetch archive', function() {
      $httpBackend.expectGET('api/cases?archived=true').respond(200, archivedCasesAPIResponse);
      var called = 0;
      caseSvc.fetchArchived()
      .then(function() {
        called++;
        expect(caseSvc.archived.length).toBe(1);
        expect(caseSvc.archived[0].caseNo).toBe(6);
        expect(caseSvc.archived[0].caseName).toBe('archived');
        expect(caseSvc.archived[0].lastTry).toBe(4);
      });

      $httpBackend.flush();
      expect(called).toBe(1);

      $httpBackend.expectGET('api/cases?archived=true').respond(200, archivedCasesAPIResponse);
      caseSvc.fetchArchived()
      .then(function() {
        called++;
        expect(caseSvc.archived.length).toBe(1);
        expect(caseSvc.archived[0].caseNo).toBe(6);
        expect(caseSvc.archived[0].caseName).toBe('archived');
        expect(caseSvc.archived[0].lastTry).toBe(4);
      });

      $httpBackend.flush();
      expect(called).toBe(2);
    });

    it('larger archive', function() {
      var archiveAPIResponse = angular.copy(archivedCasesAPIResponse);
      var baseNo = archiveAPIResponse.all_cases[0].case_id;
      var baseName = archiveAPIResponse.all_cases[0].case_name;
      var numArchived = 10;
      for (var i = 0; i < numArchived - 1; i++) {
        var newCase = {
          'case_id':   baseNo + (i + 1),
          'case_name': baseName + (i + 1),
          'lastTry':  i
        };
        archiveAPIResponse.all_cases.push(newCase);
      }

      $httpBackend.expectGET('api/cases?archived=true').respond(200, archiveAPIResponse);
      var called = 0;
      caseSvc.fetchArchived()
      .then(function() {
        called++;
        expect(caseSvc.archived.length).toBe(numArchived);
      });
      $httpBackend.flush();
      expect(called).toBe(1);

      // unarchive every odd case
      var undeleted = [];
      angular.forEach(caseSvc.archived, function(aCase) {
        if (aCase.caseNo % 2 === 1) {
          undeleted.push(aCase.caseNo);
          $httpBackend.expectPUT('api/cases/' + aCase.caseNo).respond(200, archiveAPIResponse.all_cases[aCase.caseNo - baseNo]);
          caseSvc.unarchiveCase(aCase)
          .then(function() {
            called++;
          });
        }
      });
      $httpBackend.flush();
      expect(called).toBe(undeleted.length + 1);

      // should be no odd cases in archive
      angular.forEach(caseSvc.archived, function(aCase) {
        expect(aCase.caseNo % 2).not.toBe(1);
      });

      // all cases should be readded
      angular.forEach(caseSvc.allCases, function(aCase) {
        if (aCase.caseNo > baseNo) {
          expect(aCase.caseNo % 2).toBe(1);
          expect(undeleted).toContain(aCase.caseNo);
        }
      });
    });

    it('set the last viewed at date', function() {
      $httpBackend.expectPUT('api/cases/1/metadata').respond(200, '');
      caseSvc.trackLastViewedAt(1);
      $httpBackend.flush();
    });

    it('returns cases sorted by last viewed at', function() {
      $httpBackend.expectPUT('api/cases/2/metadata').respond(200, '');
      caseSvc.trackLastViewedAt(2);
      $httpBackend.expectPUT('api/cases/1/metadata').respond(200, '');
      caseSvc.trackLastViewedAt(1);
      $httpBackend.flush();

      var dropdownCases = {
        all_cases: [
          {
            'case_id':   2,
            'case_name': 'test case 2',
            'lastTry':  3
          },
          {
            'case_id':   1,
            'case_name': 'test case',
            'lastTry':  4,
          }
        ]
      };

      $httpBackend.expectGET('api/dropdown/cases').respond(200, dropdownCases);

      caseSvc.fetchDropdownCases()
      .then(function() {
        expect(caseSvc.sorted.length).toBe(2);
        expect(caseSvc.sorted[0].caseNo).toBe(2);
        expect(caseSvc.sorted[1].caseNo).toBe(1);
      });
    });

  });

  describe('Track last score', function() {
    var $rootScope, $filter;

    var cases = [
      {
        'caseNo': 1,
        'case_name': 'test case 1',
        'lastTry': 3,
        'owned': true
      },
      {
        'caseNo': 2,
        'case_name': 'test case 2',
        'lastTry': 4,
        'owned': true
      }
    ];

    var scoreData = {
      score:      90,
      all_rated:  false,
      try_id:     3,
      queries:    {
        174: {
          score:  0,
          text:   'canine'
        }
      }
    };

    beforeEach(inject(function(_$rootScope_, _$filter_) {
      $rootScope  = _$rootScope_;
      $filter     = _$filter_;

      caseSvc.allCases    = cases;
    }));

    it('tracks the last score successfully', function() {
      $httpBackend.expectPUT('api/cases/1/scores').respond(200, '');

      caseSvc.trackLastScore(1, scoreData);
      $httpBackend.flush();
    });

    it('handles a try_number versus try_id', function() {

      delete scoreData['try_id'];
      scoreData.try_number = 33;

      $httpBackend.expectPUT('api/cases/1/scores').respond(200, '');

      caseSvc.trackLastScore(1, scoreData);
      $httpBackend.flush();
    });

    it('ignores empty scores', function() {
      var data = angular.copy(scoreData)
      data.score   = 0;
      data.queries = {};

      caseSvc.trackLastScore(1, data);

      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('does not ignore 0 scores if query object has data', function() {
      var data = angular.copy(scoreData)
      data.score   = 0;

      $httpBackend.expectPUT('api/cases/1/scores').respond(200, '');

      caseSvc.trackLastScore(1, data);

      $httpBackend.flush();
      $httpBackend.verifyNoOutstandingExpectation();
    });

    it('updates the last score of the case in the case list', function() {
      var mockResponse = scoreData;
      var dateFormat = 'yyyy-MM-dd HH:mm:ss Z';
      var created_at = $filter('date')(new Date().toUTCString(), dateFormat);
      mockResponse.created_at = created_at;

      $httpBackend.expectPUT('api/cases/1/scores').respond(200, mockResponse);

      caseSvc.trackLastScore(1, scoreData);
      $httpBackend.flush();
      $rootScope.$apply();

      var c = caseSvc.allCases[0];
      expect(c.lastScore).toBeDefined();
      expect(c.lastScore.score).toEqual(scoreData.score);
      expect(c.lastScore.created_at).toEqual(created_at);
    });

    it('tracks the scores for queries', function() {
      scoreData['queries'] = {
        '1': 50,
        '2': 0,
        '3': null
      };
      var expectedQueries = {
        '1': 50,
        '2': 0,
        '3': ''
      };
      var mockResponse = scoreData;
      var dateFormat = 'yyyy-MM-dd HH:mm:ss Z';
      var created_at = $filter('date')(new Date().toUTCString(), dateFormat);
      mockResponse.created_at = created_at;

      $httpBackend.expectPUT('api/cases/1/scores').respond(200, mockResponse);

      caseSvc.trackLastScore(1, scoreData);
      $httpBackend.flush();
      $rootScope.$apply();

      var c = caseSvc.allCases[0];
      expect(c.lastScore).toBeDefined();
      expect(c.lastScore.score).toEqual(scoreData.score);
      expect(c.lastScore.created_at).toEqual(created_at);
      expect(c.lastScore.queries).toEqual(expectedQueries);
    });
  });

  describe('Fetch last score', function() {
    var caseData = {
      'case_id':   1,
      'case_name': 'test case 1',
      'lastTry':  3,
      'owned':    true
    };

    var scoreData = {
      'score':      90,
      'all_rated':  false,
      'case_id':    1,
      'try_id':     3
    };

    it('tracks the last score successfully', function() {
      var theCase = caseSvc.constructFromData(caseData);

      $httpBackend.expectGET('api/cases/1/scores').respond(200, scoreData);

      theCase.fetchCaseScore()
        .then(function(response) { theCase = response; });
      $httpBackend.flush();

      expect(theCase.lastScore).toEqual(scoreData);
    });
  });

  describe('Fetch shared cases', function() {
    it('gets the shared cases and assigns the list to the internal array', function() {
      var url = 'api/cases';
      $httpBackend.expectGET(url).respond(200, mockCases);
      $httpBackend.expectGET('api/dropdown/cases').respond(200, mockCases);

      caseSvc.uponBeingBootstrapped().
        then(function() {
          var sharedCase = caseSvc.allCases.filter(function(item) { return item.owned === false; });
          expect(sharedCase.length).toBe(2);
        });

      $httpBackend.flush();
    });
  });

  describe('clone', function() {
    var $rootScope;

    var cases = [
      {
        'caseNo': 1,
        'case_name': 'test case 1',
        'lastTry': 3,
        'owned': true
      },
      {
        'caseNo': 2,
        'case_name': 'test case 2',
        'lastTry': 4,
        'owned': true
      }
    ];

    var theCase = cases[0];

    var expectedResponse = {
      'caseNo':   3,
      'case_name': 'Clone: test case 1',
      'lastTry':  0,
      'owned':    true
    };

    beforeEach(inject(function(_$rootScope_) {
      $rootScope  = _$rootScope_;

      caseSvc.allCases = cases;
    }));

    it('clones a case successfully', function() {
      var url = 'api/clone/cases';
      $httpBackend.expectPOST(url).respond(200, expectedResponse);

      caseSvc.cloneCase(theCase);
      $httpBackend.flush();
      $rootScope.$apply();

      expect(caseSvc.allCases.length).toBe(3);
    });
  });
});
