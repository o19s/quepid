'use strict';

describe('Controller: WizardModalCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var WizardModalCtrl;
  var $rootScope, scope;
  var settingsSvc;
  var $httpBackend;

  /*global jasmine*/
  var mockModalInstance = {
    close: jasmine.createSpy(),
    dismiss: jasmine.createSpy()
  };

  var mockUserSvc = {
    doFirstTime: false,
    getUser: function() {
      return {firstTime: this.doFirstTime};
    }
  };

  var mockWizardHandler = {
    wizard: function(){
      return {goTo: function(){}}
    }
  };

  var bootstrappedSettingsData = {
    tries: [
      {
        searchUrl: 'http://quepid-solr.dev.o19s.com/solr/tmdb/select',
        fieldSpec: 'catch_line',
        curatorVars: {},
        queryParams: 'q=#$query##',
        args: {
          q: ['#$query##']
        },
        tryNo: 0
      }
    ],
  };

  var mockTry = {
    searchUrl: 'http://quepid-solr.dev.o19s.com/solr/tmdb/select',
    fieldSpec: 'catch_line',
    curatorVars: {},
    queryParams: 'q=#$query##',
    args: {
      q: ['#$query##']
    },
    tryNo: 0
  };

  var mockUser = {
    queriesAdded:     0,
    maxQueries:       5,
    firstTime:        false,
    queriesRemaining: function() { return this.maxQueries - this.queriesAdded; },
    queryAdded:       function() { this.queriesAdded++; },
  };

  // Initialize the controller and a mock scope
  beforeEach(function() {
    module(function($provide) {
      $provide.value('$uibModalInstance', mockModalInstance);
      $provide.value('userSvc', mockUserSvc);
      $provide.value('WizardHandler', mockWizardHandler);
    });
    inject(function ($injector, $controller, _$rootScope_, _settingsSvc_) {
      $rootScope = _$rootScope_;
      scope = $rootScope.$new();
      settingsSvc = _settingsSvc_;
      $httpBackend = $injector.get('$httpBackend');
      WizardModalCtrl = $controller('WizardModalCtrl', {
        $scope: scope
      });
    });

    $rootScope.currentUser = angular.copy(mockUser);
  });

  describe('query adding', function() {
    beforeEach(function() {
      var settingsBootstrapped = 0;
      $httpBackend.expectGET('/api/cases/0/tries').respond(200, bootstrappedSettingsData);
      settingsSvc.bootstrap()
      .then(function() {
        settingsBootstrapped++;
      });
      $httpBackend.flush();
      expect(settingsBootstrapped).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    var newQueryResp = {
      displayOrder: [2,3,1,0],
      query: {
        'query_text': 'foo',
        'queryId': '3',
        'deleted': 'false'
      }
    };
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
            'doc1': '5',
            'doc2': '9'
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
            'doc1':     '1',
            'l_31284':  '10',
            'doc2':     '10'
          }
        }
      ]
    };


    it ('gets title field for autocomplete', function() {
      scope.searchFields = ['title', 'body', 'image'];
      var autocompleteList = scope.loadFields('ti');
      expect(autocompleteList.length).toBe(1);
    });

    it ('gets all fields for media: autocomplete', function() {
      scope.searchFields = ['title', 'body', 'image'];
      var autocompleteList = scope.loadFields('media:');
      expect(autocompleteList.length).toBe(3);
    });

    it ('gets all fields for thumb: autocomplete', function() {
      scope.searchFields = ['title', 'body', 'image'];
      var autocompleteList = scope.loadFields('thumb:');
      expect(autocompleteList.length).toBe(3);
    });

    it ('gets subset without modifier prefix', function() {
      scope.searchFields = ['title', 'body', 'image', 'imageAlt'];
      var autocompleteList = scope.loadFields('im');
      expect(autocompleteList.length).toBe(2);
      expect(autocompleteList).toEqual([{'text': 'image'}, {'text': 'imageAlt'}]);
    });

    it ('gets subset with modifier prefix', function() {
      scope.searchFields = ['title', 'body', 'image', 'imageAlt'];
      var autocompleteList = scope.loadFields('thumb:im');
      expect(autocompleteList.length).toBe(2);
      expect(autocompleteList).toEqual([{'text': 'thumb:image'}, {'text': 'thumb:imageAlt'}]);
    });


    // it('adds queries', function() {
    //   $httpBackend.expectPOST('/api/cases/0/tries').respond(200, mockTry);
    //   $httpBackend.expectGET('/api/cases/0/scorers').respond(200, {});
    //   $httpBackend.expectGET('/api/cases/0/queries?bootstrap=true').respond(200, mockFullQueriesResp);

    //   for (var i = 0; i < 10; i++) {
    //     var testQuery = 'foo ' + i;
    //     scope.pendingWizardSettings.addQuery(testQuery);

    //     expect(scope.pendingWizardSettings.newQueries).toContain({queryString: testQuery});
    //     expect(scope.pendingWizardSettings.newQueries).toContain({queryString: testQuery});

    //     var newQueryRespIth = angular.copy(newQueryResp);
    //     newQueryRespIth.query['query_text'] = testQuery;

    //     $httpBackend.expectPOST('/api/cases/0/queries').respond(200, newQueryRespIth);
    //     $httpBackend.expectJSONP(expectedSolrUrl(mockTry.searchUrl)).respond(200, {});
    //   }

    //   scope.pendingWizardSettings.submit();
    //   $httpBackend.flush();
    // });
  });
});
