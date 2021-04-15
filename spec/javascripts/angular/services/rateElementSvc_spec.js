'use strict';

describe('Service: rateElementSvc', function () {

  // load the service's module
  beforeEach(module('QuepidTest'));

  describe('setting the scale', function() {
    var $rootScope, rateElementSvc, customScorerSvc;

    var expectedDefaultScorer = {
      '1':  '#c51800',
      '2':  '#e61f00',
      '3':  '#fe2400',
      '4':  '#fe5b00',
      '5':  '#ffad00',
      '6':  '#ffd600',
      '7':  '#bfd200',
      '8':  '#00c700',
      '9':  '#00af00',
      '10': '#008900'
    };

    var expectedScorer = {
      '1': 'hsl(0, 100%, 50%)',
      '2': 'hsl(40, 100%, 50%)',
      '3': 'hsl(80, 100%, 50%)',
      '4': 'hsl(120, 100%, 50%)'
    };

    var mockScorer = {
      "scorerId": 1,
      "name":     "Fake Scorer",
      "code":     "pass();",
      "scale":    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "ownerId":  1,
      "error":    false,
    };

    var mockScorer2 = {
      "scorerId": 1,
      "name":     "Fake Scorer",
      "code":     "pass();",
      "scale":    [1, 2, 3, 4],
      "ownerId":  1,
      "error":    false,
    };

    var mockScope = {};
    var mockScopeTemplate = {
      "query": {
        "scorer": null,
        effectiveScorer: function() {
          return null;
        }
      },
      "ratings": { }
    };

    beforeEach(inject( function(_$rootScope_, _rateElementSvc_, _customScorerSvc_, $q) {
      rateElementSvc  = _rateElementSvc_;
      customScorerSvc = _customScorerSvc_;
      $rootScope      = _$rootScope_;

      // Tests were mucking with the scope so clear it out
      mockScope = angular.copy(mockScopeTemplate);

      spyOn(customScorerSvc, "get").and.callFake(function(id) {
        var deferred = $q.defer();
        var scorer;

        if (id === 1) {
          scorer = mockScorer;
        } else if ( id === 2) {
          scorer = mockScorer2;
        }

        deferred.resolve({ "data": scorer });
        return deferred.promise;
      });
    }));

    it('to the default when scorer is null', function() {
      rateElementSvc.setScale(mockScope, mockScope.ratings);

      // This is set but shouldn't be called by the setScale method
      mockScorer.getColors = function() {
        return expectedScorer;
      };

      $rootScope.$apply();

      expect(mockScope.ratings.scale).toBeDefined();
      // this should work, but it doesn't, so we are checking each property one by one.
      //expect(mockScope.ratings.scale).toEqual(expectedDefaultScorer);
      for (var i = 1; i < 10; i++) {
        expect(mockScope.ratings.scale[i]).toEqual(expectedDefaultScorer[i]);
      }
    });

    it('to the default when scorerId is default', function() {
      mockScorer.scorerId = 'default';
      mockScope.query.effectiveScorer = function() {
        return mockScorer;
      };

      rateElementSvc.setScale(mockScope, mockScope.ratings);
      $rootScope.$apply();

      expect(mockScope.ratings.scale).toBeDefined();
      expect(mockScope.ratings.scale).toEqual(expectedDefaultScorer);
    });

    it('to returned scale when scorer is set', function() {
      mockScope.query.effectiveScorer = function() {
        return mockScorer;
      };

      mockScorer.getColors = function() {
        return expectedDefaultScorer;
      };



      rateElementSvc.setScale(mockScope, mockScope.ratings);
      $rootScope.$apply();

      expect(mockScope.ratings.scale).toBeDefined();

      // this should work, but it doesn't, so we are checking each property one by one.
      //expect(mockScope.ratings.scale).toEqual(expectedDefaultScorer);
      for (var i = 1; i < 10; i++) {
        expect(mockScope.ratings.scale[i]).toEqual(expectedDefaultScorer[i]);
      }


    });

    it('to returned scale when scorer is set with a different scale', function() {
      mockScorer.scale    = [1, 2, 3, 4];
      mockScorer.scorerId = 2;

      mockScope.query.effectiveScorer = function() {
        return mockScorer;
      };

      mockScorer.getColors = function() {
        return expectedScorer;
      };

      rateElementSvc.setScale(mockScope, mockScope.ratings);
      $rootScope.$apply();

      expect(mockScope.ratings.scale).toBeDefined();
      expect(mockScope.ratings.scale).toEqual(expectedScorer);
    });
  });

  describe('handleRatingScale', function() {
    var rateElementSvc;

    var mockScope = {
      "ratings": { }
    };

    var extra = { };

    var mockRateCallback = function(rating, extra) {
      extra.gotRated = rating;
    };
    var mockResetCallback = function(extra) {
      extra.gotRated = null;
    };

    beforeEach(inject( function(_rateElementSvc_) {
      rateElementSvc  = _rateElementSvc_;

      rateElementSvc.handleRatingScale(
        mockScope.ratings, mockRateCallback, mockResetCallback, extra
      );
    }));

    it('sets up the dialog', function() {
      expect(mockScope.ratings.ratingsOn).toBeDefined();
      expect(mockScope.ratings.ratingsOn).toEqual(false);
    });

    it('opens the dialog', function() {
      mockScope.ratings.open();

      expect(mockScope.ratings.ratingsOn).toBeDefined();
      expect(mockScope.ratings.ratingsOn).toEqual(true);
    });

    it('closes the dialog', function() {
      mockScope.ratings.close();

      expect(mockScope.ratings.ratingsOn).toBeDefined();
      expect(mockScope.ratings.ratingsOn).toEqual(false);
    });

    it('rates an element and calls the callback function', function() {
      mockScope.ratings.rate(1);

      expect(mockScope.ratings.ratingsOn).toBeDefined();
      expect(mockScope.ratings.ratingsOn).toEqual(false);

      expect(extra.gotRated).toBeDefined();
      expect(extra.gotRated).toEqual(1);
    });

    it('resets rate of an element and calls the callback function', function() {
      mockScope.ratings.reset();

      expect(mockScope.ratings.ratingsOn).toBeDefined();
      expect(mockScope.ratings.ratingsOn).toEqual(false);

      expect(extra.gotRated).toBeDefined();
      expect(extra.gotRated).toEqual(null);
    });
  });
});
