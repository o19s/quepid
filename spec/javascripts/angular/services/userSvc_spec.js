'use strict';

describe('Service: userSvc', function () {

  // https://zeit.co/blog/async-and-await
  function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

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

      // bad!
      //sleep(500).then(() => {
        expect(currUser.scorerId).toEqual(newScorerId);
      //});

    });

    it('updates a user\'s default scorer', function() {
      console.log("super before currUser.scorerId:" + currUser.scorerId);
      var url           = '/api/users/' + mockUser.id;
      var newScorerId   = 90;
      var data          = { user: { default_scorer_id: newScorerId } };
      mockUser.scorerId = newScorerId;

      console.log("mockUser");
      console.log(mockUser);

      $httpBackend.expectPUT(url, data).respond(200, mockUser);

      currUser.updateDefaultScorer(newScorerId);
      console.log("before currUser.scorerId:" + currUser.scorerId);
      console.log("before newScorerId:" + newScorerId);

      $httpBackend.flush();
      sleep(100).then(() => {

        // bad!
        //sleep(0).then(() => {

      });
      console.log("currUser.scorerId:" + currUser.scorerId);
      console.log("newScorerId:" + newScorerId);
      expect(currUser.scorerId).toEqual(newScorerId);



      //});
    });
  });

});
