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
      'username': 'mockUsername',
      'scorerId': 10,
      'id':       1,
    };

    var url = '/api/users/' + mockUser.id;
    $httpBackend.expectGET(url).respond(200, mockUser);

    userSvc.get(mockUser.id)
      .then(function(response) {
        expect(response.username).toEqual(mockUser.username);
        expect(response.scorerId).toEqual(mockUser.scorerId);
      });

    $httpBackend.flush();
  });

  describe('User instance', function() {
    var currUser;

    var mockUser = {
      'username': 'mockUsername',
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

      expect(currUser.firstTime).toEqual(false);
    });

    it('updates a user\'s scorer', function() {
      var url           = '/api/users/' + mockUser.id;
      var newScorerId   = 90;
      var data          = { user: { scorer_id: newScorerId } };
      mockUser.scorerId = newScorerId;

      $httpBackend.expectPUT(url, data).respond(200, mockUser);

      currUser.updateUserScorer(newScorerId);

      $httpBackend.flush();

      expect(currUser.scorerId).toEqual(newScorerId);
    });

    it('updates a user\'s default scorer', function() {
      var url           = '/api/users/' + mockUser.id;
      var newScorerId   = 90;
      var data          = { user: { default_scorer_id: newScorerId } };
      mockUser.scorerId = newScorerId;

      $httpBackend.expectPUT(url, data).respond(200, mockUser);

      currUser.updateDefaultScorer(newScorerId);

      $httpBackend.flush();

      expect(currUser.scorerId).toEqual(newScorerId);
    });
  });

});
