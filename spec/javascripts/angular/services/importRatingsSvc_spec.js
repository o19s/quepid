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
        'query':       'dog',
        'docid':      'i_801',
        'rating':     '8'
      },
      {
        'query':      'dog',
        'docid':      'i_802',
        'rating':     '5'
      },
      {
        'query':     'cat',
        'docid':     'i_803',
        'rating':    '3'
      },
      {
        'query':     'parrot',
        'docid':     '',
        'rating':    ''
      },
    ];

    var mockCase = {
      caseNo: 8
    };

    var mockRREJson = {
      "id_field": "id",
      "index": "Movies Search",
      "template": "template.json",
      "queries": [
        {
          "placeholders": {
            "$query": "star trek"
          },
          "relevant_documents": {
            "1": [
              "193"
            ],
            "2": [
              "157",
              "152"
            ]
          }
        },
        {
          "placeholders": {
            "$query": "star wars"
          },
          "relevant_documents": {
            "1": [
              "12180"
            ],
            "2": [
              "13532",
              "1895"
            ]
          }
        }
      ]
    }


    it('imports ratings multiple queries and multiple docs', function() {
      var url = '/api/import/ratings?file_format=hash';

      $httpBackend.expectPOST(url).respond(200, {});

      importRatingsSvc.importCSVFormat(mockCase, mockCsv);

      $httpBackend.flush();
      $rootScope.$apply();
    });

    it('imports rre format', function() {
      var url = '/api/import/ratings?file_format=rre';

      $httpBackend.expectPOST(url).respond(200, {});

      importRatingsSvc.importRREFormat(mockCase, mockRREJson);

      $httpBackend.flush();
      $rootScope.$apply();
    });
  });

  describe('Import information needs', function() {
    var $rootScope;

    beforeEach(function() {
      inject(function (_$rootScope_) {
        $rootScope = _$rootScope_;
      });
    });

    var mockCsv = [
      {
        'query_id':         '1',
        'query_text':       'star wars',
        'information_need': 'The original epic star wars movie'
      },
      {
        'query_id':         '2',
        'query_text':       'tough times on hoth',
        'information_need': 'The Empire Strikes back movie'
      },
      {
        'query_id':         '3',
        'query_text':       'tatooine in star wars',
        'information_need': 'Any of the star wars movies mentioning tatooine, plus the mandalorian and story of boba fett'
      },
      {
        'query_id':         '4',
        'query_text':       'star trek',
        'information_need': 'The star trek movies, but definitly not any star wars movies.'
      }
    ];

    var mockCase = {
      caseNo: 8
    };



    it('imports information needs', function() {
      var url = '/api/import/queries/information_needs';

      $httpBackend.expectPOST(url).respond(200, {});

      importRatingsSvc.importInformationNeeds(mockCase, mockCsv);

      $httpBackend.flush();
      $rootScope.$apply();
    });

  });
});
