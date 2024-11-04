'use strict';

describe('Service: userSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var userSvc;
  var $httpBackend;

  beforeEach(inject(function (_userSvc_, $injector) {
    userSvc = _userSvc_;

    $httpBackend = $injector.get('$httpBackend');
    $httpBackend.whenGET('/angularjs/views/404.html').respond(200, "");
  }));

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  it('should do something', function () {
    expect(!!userSvc).toBe(true);
  });

  it('fetches user info', function() {
    var mockUser = {
      'email': 'mockEmail@example.com',
      'defaultScorerId': 10,
      'id':       1,
    };

    var mockUserResponse = {
      'email': 'mockEmail@example.com',
      'default_scorer_id': 10,
      'id':       1,
    };

    var url = 'api/users/' + mockUser.id;
    $httpBackend.expectGET(url).respond(200, mockUserResponse);

    userSvc.get(mockUser.id)
      .then(function(response) {
        expect(response.email).toEqual(mockUser.email);
        expect(response.default_scorer_id).toEqual(mockUser.default_scorer_id);
      });

    $httpBackend.flush();
  });

  describe('User instance', function() {
    var currUser;

    var mockUser = {
      'email': 'mockEmail@example.com',
      'defaultScorerId': 10,
      'id':       1,
    };

    var mockUserResponse = {
     'email': 'mockEmail@example.com',
     'default_scorer_id': 10,
     'id':       1,
    };

    beforeEach(inject(function () {
      var url = 'api/users/' + mockUser.id;
      $httpBackend.expectGET(url).respond(200, mockUserResponse);

      userSvc.get(mockUser.id)
        .then(function(response) {
          currUser = response;
        });

      $httpBackend.flush();
    }));

    it('updates user after first login', function() {
      var url           = 'api/users/' + mockUser.id;
      var data          = { user: { completed_case_wizard: true } };

      $httpBackend.expectPUT(url, data).respond(200, mockUserResponse);

      currUser.shownIntroWizard();

      $httpBackend.flush();

      expect(currUser.completedCaseWizard).toEqual(true);
    });

    it('updates a user\'s scorer', function() {
      var url           = 'api/users/' + mockUser.id;
      var newScorerId   = 90;
      var data          = { user: { default_scorer_id: newScorerId } };
      mockUser.defaultScorerId = newScorerId;

      $httpBackend.expectPUT(url, data).respond(200, mockUserResponse);

      currUser.updateUserScorer(newScorerId);

      $httpBackend.flush();

      expect(currUser.defaultScorerId).toEqual(newScorerId);
    });

  });

});
