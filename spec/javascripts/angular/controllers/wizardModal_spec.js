'use strict';

/*global URI, expectedSolrUrl, jasmine*/

describe('Controller: WizardModalCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var WizardModalCtrl;
  var $rootScope, scope;
  var settingsSvc;
  var $httpBackend;

  var mockModalInstance = {
    close: jasmine.createSpy(),
    dismiss: jasmine.createSpy()
  };



  var mockWizardHandler = {
    wizard: function(){
      return {goTo: function(){}};
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
      mockUser.introWizardSeen=true;
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

      // Handle the case data fetch for book sync properties (triggered by queriesSvc.changeSettings)
      $httpBackend.whenGET(/^api\/cases\/\d+$/).respond(200, {book_id: null, auto_populate_book_pairs: false});

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

        $httpBackend.whenPOST('api/bulk/cases/0/queries').respond(200, newQueryRespIth);
        $httpBackend.whenJSONP(expectedSolrUrl(mockTry.search_url)).respond(200, {});
      }

      scope.pendingWizardSettings.submit();
      $httpBackend.flush();
    });

    it('shows an error when finish save fails', function() {
      mockModalInstance.close.calls.reset();
      $httpBackend.expectPUT('api/cases/0/tries/0').respond(500, { status: 500, error: 'Internal Server Error' });

      scope.pendingWizardSettings.submit();
      $httpBackend.flush();

      expect(scope.finishSaveError).toBe('Could not save your case settings: Internal Server Error. Please click Finish to try again.');
      expect(scope.savingFinish).toBe(false);
      expect(mockModalInstance.close).not.toHaveBeenCalled();
    });

    it('shows validation errors when finish save fails with bad request', function() {
      mockModalInstance.close.calls.reset();
      $httpBackend.expectPUT('api/cases/0/tries/0').respond(400, {
        proxy_requests: [ 'must be enabled when basic auth credentials are present' ],
      });

      scope.pendingWizardSettings.submit();
      $httpBackend.flush();

      expect(scope.finishSaveError).toBe(
        'Could not save your case settings: proxy_requests must be enabled when basic auth credentials are present. Please click Finish to try again.'
      );
      expect(scope.savingFinish).toBe(false);
      expect(mockModalInstance.close).not.toHaveBeenCalled();
    });
  });
  
  describe('parse url', function() {
    it('blows up on %', function() {
      var url = 'http://username:pass%@quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json';
      expect(function() {
        new URI(url);
      }).toThrowError('URI malformed');
    });
    
    it('Works with %25', function() {
      var url = 'http://username:pass%25@quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json';
      
      var a = new URI(url);
      expect(a.password()).toBe('pass%');
      expect(a.username()).toBe('username');
    });
    
    it('Works with %25 nested', function() {
      var url = 'http://username:pass%25word@quepid-solr.dev.o19s.com:8985/solr/tmdb/select?q=*:*&fl=*&wt=json';
      
      var a = new URI(url);
      expect(a.password()).toBe('pass%word');
      expect(a.username()).toBe('username');
    });

  });
});

describe('Controller: WizardModalCtrl — validating flag lifecycle', function () {

  beforeEach(module('QuepidTest'));

  var $rootScope, $q, scope;
  var validatorDeferred;
  var nextSpy;

  beforeEach(function () {
    /*global jasmine*/
    nextSpy = jasmine.createSpy('wizard.next');

    module(function ($provide) {
      $provide.value('$uibModalInstance', { close: function () {}, dismiss: function () {} });
      $provide.value('userSvc', { getUser: function () { return { completedCaseWizard: true }; } });
      $provide.value('WizardHandler', { wizard: function () { return { next: nextSpy, goTo: function () {} }; } });

      $provide.value('SettingsValidatorFactory', function () {
        this.validateUrl = function () { return validatorDeferred.promise; };
        this.fieldSpec   = function () { return { fieldList: function () { return []; } }; };
      });
    });

    inject(function ($injector, $controller, _$rootScope_, _$q_) {
      $rootScope = _$rootScope_;
      $q = _$q_;
      scope = $rootScope.$new();
      validatorDeferred = $q.defer();

      var $httpBackend = $injector.get('$httpBackend');
      $httpBackend.whenGET(/^api\/cases\/\d+$/).respond(200, {});
      $httpBackend.whenGET(/^api\/search_endpoints/).respond(200, {});
      $httpBackend.whenGET(/^api\/cases\/\d+\/tries/).respond(200, { tries: [] });

      $controller('WizardModalCtrl', { $scope: scope });
    });
  });

  function primeSearchapi(extra) {
    scope.pendingWizardSettings = angular.extend({
      searchEngine:   'searchapi',
      searchUrl:      'http://example.com/search',
      testQuery:      'foo',
      queryParams:    '',
      mapperCode:     'window.numberOfResultsMapper = function(){return 0;};' +
                      'window.docsMapper = function(){return [];};',
      proxyRequests:  false,
      customHeaders:  '',
    }, extra || {});
  }

  it('clears validating when validateUrl() resolves and justValidate=true (ping it)', function () {
    primeSearchapi();
    scope.validate(true);
    expect(scope.validating).toBe(true);

    validatorDeferred.resolve();
    $rootScope.$digest();

    expect(scope.validating).toBe(false);
    expect(scope.urlValid).toBe(true);
    expect(nextSpy).not.toHaveBeenCalled();
  });

  it('clears validating and navigates when validateUrl() resolves and justValidate=false', function () {
    primeSearchapi();
    scope.validate(false);

    validatorDeferred.resolve();
    $rootScope.$digest();

    expect(scope.validating).toBe(false);
    expect(scope.urlValid).toBe(true);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('clears validating when validateUrl() rejects', function () {
    primeSearchapi();
    scope.validate(false);

    validatorDeferred.reject('Error: boom');
    $rootScope.$digest();

    expect(scope.validating).toBe(false);
    expect(scope.urlInvalid).toBe(true);
    expect(scope.isHeaderConfigCollapsed).toBe(true);
    expect(nextSpy).not.toHaveBeenCalled();
  });

  it('clears validating on mapper eval failure (early-exit before validateUrl)', function () {
    primeSearchapi({ mapperCode: 'throw new Error("kaboom");' });
    scope.validate(false);

    expect(scope.validating).toBe(false);
    expect(scope.mapperInvalid).toBe(true);
  });

  it('toggleHeaderConfig flips the flag on the controller scope', function () {
    scope.isHeaderConfigCollapsed = false;

    scope.toggleHeaderConfig();
    expect(scope.isHeaderConfigCollapsed).toBe(true);

    scope.toggleHeaderConfig();
    expect(scope.isHeaderConfigCollapsed).toBe(false);
  });

  // Regression: the Advanced section lives inside an ng-if, which creates a child
  // scope. An inline `ng-click="x = !x"` would shadow the primitive on that child,
  // disconnecting it from the controller so later programmatic opens never reach
  // uib-collapse. Toggling through the controller function must avoid that.
  it('reopens the Advanced panel on validation failure even after a manual toggle', function () {
    primeSearchapi();
    scope.isHeaderConfigCollapsed = true;

    // The Advanced button toggles on the ng-if child scope, not the controller.
    var childScope = scope.$new();
    childScope.toggleHeaderConfig();

    expect(scope.isHeaderConfigCollapsed).toBe(false);
    expect(childScope.hasOwnProperty('isHeaderConfigCollapsed')).toBe(false); // no shadow created

    // A failed validation reopens the panel programmatically on the controller scope.
    scope.validate(false);
    validatorDeferred.reject('Error: boom');
    $rootScope.$digest();

    // uib-collapse binds against the child scope, so it must see the reopened value.
    expect(scope.isHeaderConfigCollapsed).toBe(true);
    expect(childScope.isHeaderConfigCollapsed).toBe(true);
  });
});
