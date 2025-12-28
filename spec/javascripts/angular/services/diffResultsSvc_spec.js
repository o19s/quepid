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

  var mockQueryViewSvc = {
    diffSettings: [],
    getAllDiffSettings: function() {
      return this.diffSettings;
    },
    setDiffSettings: function(settings) {
      this.diffSettings = settings;
    }
  };

  var mockRatingsStore = {
    createRateableDoc: function(doc) {
      var rateableDoc = angular.copy(doc);
      rateableDoc.hasRating = function() { return false; };
      rateableDoc.getRating = function() { return null; };
      rateableDoc.ratedOnly = false;
      return rateableDoc;
    }
  };

  var mockSnapshotSearcherSvc = {
    createSearcherFromSnapshot: function(snapshotId, query, settings) {
      var snapshot = mockQuerySnapshotSvc.snapshots[snapshotId];
      if (!snapshot) return null;
      
      return {
        docs: snapshot.getSearchResults().map(function(doc) {
          return mockRatingsStore.createRateableDoc(angular.copy(doc));
        }),
        search: function() {
          return $q.resolve();
        },
        name: function() {
          return 'Snapshot ' + snapshotId;
        },
        version: function() {
          return snapshotId;
        },
        diffScore: { score: '?', allRated: false }
      };
    }
  };

  // load the service's module
  beforeEach(module('QuepidApp'));

  beforeEach(function() {
    module(function($provide) {
      /*global MockSettingsSvc*/
      mockSettingsSvc = new MockSettingsSvc();

      $provide.value('settingsSvc', mockSettingsSvc);
      $provide.value('querySnapshotSvc', mockQuerySnapshotSvc);
      $provide.value('queryViewSvc', mockQueryViewSvc);
      $provide.value('snapshotSearcherSvc', mockSnapshotSearcherSvc);
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
    beforeEach(function(done) {
      var snapshotId = 0;
      mockQueryViewSvc.setDiffSettings([snapshotId]);
      diffResultsSvc.createQueryDiff(fakeQuery);
      
      // Wait for multiDiff to be created and diff wrapper to be available
      $rootScope.$apply();
      setTimeout(function() {
        expect(fakeQuery.diff).not.toBe(null);
        expect(fakeQuery.diff.docs().length).toEqual(2);
        done();
      }, 0);
    });

    it('contains correct docs', function(done) {
      fakeQuery.diff.fetch().then(function() {
        var docs = fakeQuery.diff.docs();
        expect(docs.length).toEqual(2);
        expect(docs.some(function(doc) { return doc.id === '1' && doc.field1 === 'cats'; })).toBe(true);
        expect(docs.some(function(doc) { return doc.id === '2' && doc.field1 === 'dogs'; })).toBe(true);
        done();
      });

      $rootScope.$apply();
    });

    it('asks correct docs to be scored', function(done) {
      fakeQuery.diff.fetch().then(function() {
        expect(fakeQuery.lastScoreDocs.length).toEqual(2);
        expect(fakeQuery.lastScoreDocs.some(function(doc) { return doc.id === '1' && doc.field1 === 'cats'; })).toBe(true);
        expect(fakeQuery.lastScoreDocs.some(function(doc) { return doc.id === '2' && doc.field1 === 'dogs'; })).toBe(true);
        expect(fakeQuery.diff.docs().length).toEqual(2);
        done();
      });

      $rootScope.$apply();
    });
    it('refetches same docs', function(done) {
      var called = 0;
      fakeQuery.diff.fetch().then(function() {
        var docs = fakeQuery.diff.docs();
        expect(docs.length).toEqual(2);
        expect(docs.some(function(doc) { return doc.id === '1' && doc.field1 === 'cats'; })).toBe(true);
        expect(docs.some(function(doc) { return doc.id === '2' && doc.field1 === 'dogs'; })).toBe(true);
        called++;

        // Second fetch
        fakeQuery.diff.fetch().then(function() {
          var docs2 = fakeQuery.diff.docs();
          expect(docs2.length).toEqual(2);
          expect(docs2.some(function(doc) { return doc.id === '1' && doc.field1 === 'cats'; })).toBe(true);
          expect(docs2.some(function(doc) { return doc.id === '2' && doc.field1 === 'dogs'; })).toBe(true);
          called++;
          expect(called).toBe(2);
          done();
        });
      });

      $rootScope.$apply();
    });
  });

});
