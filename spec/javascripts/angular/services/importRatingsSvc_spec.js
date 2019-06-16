'use strict';

describe('Service: importRatingsSvc', function () {

  // load the service's module
  beforeEach(module('QuepidApp'));

  // instantiate service
  var importRatingsSvc;
  var $httpBackend;

  beforeEach(function() {
    inject(function ($injector, _importRatingsSvc_) {
      $httpBackend = $injector.get('$httpBackend');
      importRatingsSvc = _importRatingsSvc_;
    });
  });

  describe('Import ratings', function() {
    var $rootScope;

    beforeEach(function() {
      inject(function (_$rootScope_) {
        $rootScope = _$rootScope_;
      });
    });

    var mockCsv = [
      {
        'Query Text': 'dog',
        'Doc ID':     'i_801',
        'Rating':     '8'
      },
      {
        'Query Text': 'dog',
        'Doc ID':     'i_802',
        'Rating':     '5'
      },
      {
        'Query Text': 'cat',
        'Doc ID':     'i_803',
        'Rating':     '3'
      },
    ];

    var mockCase = {
      caseNo: 8
    };

    it('imports ratings multiple queries and multiple docs', function() {
      var url = '/api/import/ratings';

      $httpBackend.expectPOST(url).respond(200, {});

      importRatingsSvc.makeCall(mockCase, mockCsv);

      $httpBackend.flush();
      $rootScope.$apply();
    });
  });
});
