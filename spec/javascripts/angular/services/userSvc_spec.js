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

    var url = '/api/users/' + mockUser.id;
    $httpBackend.expectGET(url).respond(200, mockUser);

    userSvc.get(mockUser.id)
      .then(function(response) {
        expect(response.email).toEqual(mockUser.email);
        expect(response.defaultScorerId).toEqual(mockUser.defaultScorerId);
      });

    $httpBackend.flush();
  });

  describe('User instance', function() {
    var currUser;

    var mockUser = {
      'email': 'mockEmail@example.com',
      'scorerId': 10,
      'id':       1,
    };

    beforeEach(inject(function () {
      var url = '/api/users/' + mockUser.id;
      $httpBackend.expectGET(url).respond(200, mockUser);

      userSvc.get(mockUser.id)
        .then(function(response) {
          currUser = response;
        });

      $httpBackend.flush();
    }));

    it('updates user after first login', function() {
      var url           = '/api/users/' + mockUser.id;
      var data          = { user: { first_login: false } };

      $httpBackend.expectPUT(url, data).respond(200, mockUser);

      currUser.shownIntroWizard();

      $httpBackend.flush();

      expect(currUser.firstLogin).toEqual(false);
    });

    it('updates a user\'s scorer', function() {
      var url           = '/api/users/' + mockUser.id;
      var newScorerId   = 90;
      var data          = { user: { default_scorer_id: newScorerId } };
      mockUser.defaultScorerId = newScorerId;

      $httpBackend.expectPUT(url, data).respond(200, mockUser);

      currUser.updateUserScorer(newScorerId);

      $httpBackend.flush();

      expect(currUser.defaultScorerId).toEqual(newScorerId);
    });

  });

});
