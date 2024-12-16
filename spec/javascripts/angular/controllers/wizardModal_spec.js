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



  var mockWizardHandler = {
    wizard: function(){
      return {goTo: function(){}}
    }
  };

  var bootstrappedSettingsData = {
    tries: [
      {
        search_url: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select',
        field_spec: 'catch_line',
        curator_vars: {},
        query_params: 'q=#$query##',
        args: {
          q: ['#$query##']
        },
        try_number: 0
      }
    ],
  };

  var mockTry = {
    search_url: 'http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select',
    field_spec: 'catch_line',
    curator_vars: {},
    query_params: 'q=#$query##',
    args: {
      q: ['#$query##']
    },
    try_number: 0
  };

  var mockUser = {
    completedCaseWizard:       true,
    introWizardSeen: false,
    shownIntroWizard: function() {
      self.introWizardSeen=true;
    }
  };

  var mockUserSvc = {
    getUser: function() {
      return mockUser;
    }

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
      $httpBackend.expectGET('api/search_endpoints').respond(200, {});
      $httpBackend.expectGET('api/cases/0/tries').respond(200, bootstrappedSettingsData);
      settingsSvc.bootstrap()
      .then(function() {
        settingsBootstrapped++;
      });
      $httpBackend.flush();
      expect(settingsBootstrapped).toBe(1);
      $httpBackend.verifyNoOutstandingExpectation();
    });

    var newQueryResp = {
      display_order: [2,3,1,0],
      query: {
        'query_text': 'foo',
        'queryId': '3',
        'deleted': 'false'
      }
    };
    var mockFullQueriesResp = {
      display_order: [2,1,0],
      queries: [
        {
          'arranged_at':   '3681400536',
          'arranged_next': '4294967295',
          'deleted':      'false',
          'queryId':      '0',
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
          'queryId':      '1',
          'query_text':   'how is kidney cancer diagnosed'
        },
        {
          'arranged_at':   '0',
          'arranged_next': '613566756',
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

    it('adds queries', function() {
      $httpBackend.expectPUT('api/cases/0/tries/0').respond(200, mockTry);
      $httpBackend.expectGET('api/cases/0/scorers').respond(200, {});
      $httpBackend.expectGET('api/cases/0/queries?bootstrap=true').respond(200, mockFullQueriesResp);

      for (var i = 0; i < 10; i++) {
        var testQuery = 'foo ' + i;
        scope.pendingWizardSettings.addQuery(testQuery);

        expect(scope.pendingWizardSettings.newQueries).toContain({queryString: testQuery});

        var newQueryRespIth = angular.copy(newQueryResp);
        newQueryRespIth.query['query_text'] = testQuery;

        $httpBackend.whenPOST('api/cases/0/queries').respond(200, newQueryRespIth);
        $httpBackend.whenJSONP(expectedSolrUrl(mockTry.search_url)).respond(200, {});
      }

      scope.pendingWizardSettings.submit();
      $httpBackend.flush();
    });
  });
  
  describe('parse url', function() {
    it('blows up on %', function() {
      var url = "http://username:pass%@quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json";
      expect(function() {
        new URI(url);
      }).toThrowError('URI malformed');
    });
    
    it('Works with %25', function() {
      var url = "http://username:pass%25@quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json";
      
      var a = new URI(url);
      expect(a.password()).toBe('pass%');
      expect(a.username()).toBe('username');
    });
    
    it('Works with %25 nested', function() {
      var url = "http://username:pass%25word@quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json";
      
      var a = new URI(url);
      expect(a.password()).toBe('pass%word');
      expect(a.username()).toBe('username');
    });    
    
    it('validates the basic auth credentials', function() {
      expect(scope.invalidBasicAuthCredentials).toBe(false);
      scope.pendingWizardSettings.basicAuthCredential = "username:pass%";
      scope.validateBasicAuthCredentials();
      expect(scope.invalidBasicAuthCredentials).toBe(true);
    });   
    
  });
});
