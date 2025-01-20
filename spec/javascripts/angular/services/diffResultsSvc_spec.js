'use strict';

describe('Service: diffResultsSvc', function() {
  var $httpBackend = null;
  var $rootScope;
  var $q;
  var diffResultsSvc;
  var docResolverSvc;
  var ratingsStoreSvc;
  var mockResolver = null;
  var mockSettingsSvc;
  var doc1 = {
    id: '1',
    field1: 'cats'
  };
  var doc2 = {
    id: '2',
    field1: 'dogs'
  };
  var doc3 = {
    id: '3',
    field1: 'pigeons'
  };

  var mockSnapshot1 = {
    getSearchResults: function() {
      return [doc1, doc2];
    }
  };

  var mockSnapshot2 = {
    getSearchResults: function() {
      return [doc2, doc1, doc3];
    }
  };

  var mockQuerySnapshotSvc = {
    snapshots: [mockSnapshot1, mockSnapshot2]
  };

  // load the service's module
  beforeEach(module('QuepidApp'));

  beforeEach(function() {
    module(function($provide) {
      /*global MockSettingsSvc*/
      mockSettingsSvc = new MockSettingsSvc();

      $provide.value('settingsSvc', mockSettingsSvc);
      $provide.value('querySnapshotSvc', mockQuerySnapshotSvc);
    });
    inject(function (_$rootScope_, _$q_, _diffResultsSvc_, _fieldSpecSvc_, _ratingsStoreSvc_, _docResolverSvc_, $injector) {
      $httpBackend      = $injector.get('$httpBackend');
      $q                = _$q_;
      $rootScope        = _$rootScope_;
      diffResultsSvc    = _diffResultsSvc_;
      ratingsStoreSvc   = _ratingsStoreSvc_;
      docResolverSvc    = _docResolverSvc_;
      var mockFieldSpec = _fieldSpecSvc_.createFieldSpec('field field1');

      mockSettingsSvc.setMockFieldSpec(mockFieldSpec);

      spyOn(docResolverSvc, "createResolver").and
        .callFake(function(ids, settings) {
          /*global MockResolver*/
          this.mockResolver = new MockResolver(ids, settings, $q);
          return this.mockResolver;
        });

        mockResolver = docResolverSvc.mockResolver;
    });
  });

  var fakeQuery = {
    queryId: 1,
    lastScoreDocs: null,
    score: function() {
      return {score: 50, allRated: true};
    },
    scoreOthers: function(docs) {
      this.lastScoreDocs = docs;
      return {score: 50, allRated: true};
    },
    ratingsStore: {
      createRateableDoc: function (doc) {
        doc.ratedOnly = false;

        doc.getRating = function() {
          if (doc.id === '3') {
            return 10;
          }
          if (doc.id === '2') {
            return 7;
          }
          if (doc.id === '1') {
            return 5;
          }
        };

        return doc;
      },

      bestDocs: function() {
        return [doc3, doc2, doc1];
      },

      version: function() {
        return 0;
      }
    },
  };

  it('has empty docs on no active diff', function() {
    diffResultsSvc.createQueryDiff(fakeQuery, null);
    expect(fakeQuery.diff).toBe(null);
  });

  describe('snapshot diff', function() {
    beforeEach(function() {
      var snapshotId = 0;
      diffResultsSvc.setDiffSetting(snapshotId);
      diffResultsSvc.createQueryDiff(fakeQuery);
      expect(fakeQuery.diff.docs().length).toEqual(2);
    });

    it('contains correct docs', function() {
      var called = 0;
      fakeQuery.diff.fetch().then(function() {
        expect(fakeQuery.diff.docs()).toContain(doc1);
        expect(fakeQuery.diff.docs()).toContain(doc2);
        expect(fakeQuery.diff.docs().length).toEqual(2);
        called++;
      });

      $rootScope.$apply();
      expect(called).toBe(1);
    });

    it('asks correct docs to be scored', function() {
      var called = 0;
      fakeQuery.diff.fetch().then(function() {
        expect(fakeQuery.lastScoreDocs).toContain(doc1);
        expect(fakeQuery.lastScoreDocs).toContain(doc2);
        expect(fakeQuery.diff.docs().length).toEqual(2);
        called++;
      });

      $rootScope.$apply();
      expect(called).toBe(1);
    });
    it('refetches same docs', function() {
      var called = 0;
      fakeQuery.diff.fetch().then(function() {
        expect(fakeQuery.diff.docs()).toContain(doc1);
        expect(fakeQuery.diff.docs()).toContain(doc2);
        expect(fakeQuery.diff.docs().length).toEqual(2);
        called++;
      });

      $rootScope.$apply();
      expect(called).toBe(1);

      fakeQuery.diff.fetch();
      fakeQuery.diff.fetch().then(function() {
        expect(fakeQuery.diff.docs()).toContain(doc1);
        expect(fakeQuery.diff.docs()).toContain(doc2);
        expect(fakeQuery.diff.docs().length).toEqual(2);
        called++;
      });

      $rootScope.$apply();
      expect(called).toBe(2);
    });
  });

});
