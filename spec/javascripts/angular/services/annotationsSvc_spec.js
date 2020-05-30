'use strict';

describe('Service: annotationsSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  // instantiate service
  var annotationsSvc;
  var $httpBackend;

  beforeEach(inject(function (_annotationsSvc_, $injector) {
    annotationsSvc = _annotationsSvc_;

    $httpBackend = $injector.get('$httpBackend');
  }));

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  describe('create', function() {
    var score  = {
      all_rated:  false,
      score:      75,
      try_id:     1,
    };

    var annotation = {
      message:  'create test',
      source:   ''
    };

    var response = {
      id:         10,
      user_id:    1,
      message:    "create test",
      source      :null,
      created_at: "2016-04-13T20:02:11.784Z",
      updated_at: "2016-04-13T20:02:11.784Z",
      score: {
        id:         122,
        case_id     :48,
        user_id:    1,
        email:      "ychaker@o19s.com",
        try_id:     0,
        score:      0.0,
        all_rated:  true,
        created_at: "2016-04-13T20:02:11.702Z",
        shallow:    true
      },
      user: {
        name: "ychaker@o19s.com"
      }
    };

    it('makes an API call', function() {
      var data  = {
        score:      score,
        annotation: annotation
      };

      $httpBackend.expectPOST('/api/cases/1/annotations', data).respond(response);

      annotationsSvc.create(1, data);
      $httpBackend.flush();
    });

    it('returns an annotation', function() {
      var data  = {
        score:      score,
        annotation: annotation
      };

      $httpBackend.expectPOST('/api/cases/1/annotations', data).respond(response);

      annotationsSvc.create(1, data)
        .then(function (annotation) {
          expect(annotation).not.toBe(null);
          expect(annotation.message).toEqual(response.message);
        });
      $httpBackend.flush();
    });
  });

  describe('update', function() {
    var annotation = {
      caseId:   1,
      id:       1,
      message:  'create test',
      source:   ''
    };

    var response = {
      id:         10,
      user_id:    1,
      message:    "create test",
      source      :null,
      created_at: "2016-04-13T20:02:11.784Z",
      updated_at: "2016-04-13T20:02:11.784Z",
      score: {
        id:         122,
        case_id     :48,
        user_id:    1,
        email:      "ychaker@o19s.com",
        try_id:     0,
        score:      0.0,
        all_rated:  true,
        created_at: "2016-04-13T20:02:11.702Z",
        shallow:    true
      },
      user: {
        name: "ychaker@o19s.com"
      }
    };

    it('makes an API call', function() {
      var data  = {
        annotation: {
          message:  annotation.message,
          source:   annotation.source,
        }
      };

      $httpBackend.expectPUT('/api/cases/1/annotations/1', data).respond(response);

      annotationsSvc.update(annotation);
      $httpBackend.flush();
    });

    it('returns an annotation', function() {
      var data  = {
        annotation: {
          message:  annotation.message,
          source:   annotation.source,
        }
      };

      $httpBackend.expectPUT('/api/cases/1/annotations/1', data).respond(response);

      annotationsSvc.update(annotation)
        .then(function (annotation) {
          expect(annotation).not.toBe(null);
        });
      $httpBackend.flush();
    });
  });

  describe('delete', function() {
    var annotation = {
      caseId:   1,
      id:       1,
      message:  'create test',
      source:   ''
    };

    it('makes an API call', function() {
      $httpBackend.expectDELETE('/api/cases/1/annotations/1').respond({});

      annotationsSvc.delete(annotation);
      $httpBackend.flush();
    });
  });
});
