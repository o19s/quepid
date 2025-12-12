'use strict';

describe('Service: snapshotSearcherSvc', function () {

  // load the service's module
  beforeEach(module('QuepidApp'));

  var snapshotSearcherSvc;
  var querySnapshotSvc;
  var normalDocsSvc;
  var mockQuery;
  var mockSnapshot;
  var mockSettings;
  var $q;
  var $rootScope;

  beforeEach(inject(function (_snapshotSearcherSvc_, _querySnapshotSvc_, _normalDocsSvc_, _$q_, _$rootScope_) {
    snapshotSearcherSvc = _snapshotSearcherSvc_;
    querySnapshotSvc = _querySnapshotSvc_;
    normalDocsSvc = _normalDocsSvc_;
    $q = _$q_;
    $rootScope = _$rootScope_;

    // Mock settings
    mockSettings = {
      createFieldSpec: function() {
        return 'id title';
      }
    };

    // Mock query with ratings store
    mockQuery = {
      queryId: 'test-query-1',
      queryText: 'test query',
      version: function() { return 1; },
      ratingsStore: {
        createRateableDoc: function(doc) {
          var rateableDoc = angular.copy(doc);
          rateableDoc.hasRating = function() { return false; };
          rateableDoc.getRating = function() { return null; };
          rateableDoc.score = function() { return doc.explain ? 1.5 : 0; };
          return rateableDoc;
        }
      }
    };

    // Mock snapshot with sample data
    mockSnapshot = {
      id: 'snapshot-1',
      name: function() { return 'Test Snapshot'; },
      getSearchResults: function(queryId) {
        if (queryId === 'test-query-1') {
          return [
            {
              id: 'doc1',
              title: 'First Document',
              explain: '{"value": 1.5, "description": "test"}',
              rated_only: false,
              fields: { title: 'First Document', id: 'doc1' }
            },
            {
              id: 'doc2', 
              title: 'Second Document',
              explain: '{"value": 1.2, "description": "test"}',
              rated_only: false,
              fields: { title: 'Second Document', id: 'doc2' }
            },
            {
              id: 'doc3',
              title: 'Rated Document',
              explain: '{"value": 2.0, "description": "test"}',
              rated_only: true,
              fields: { title: 'Rated Document', id: 'doc3' }
            }
          ];
        }
        return [];
      }
    };

    // Mock querySnapshotSvc
    querySnapshotSvc.snapshots = {
      'snapshot-1': mockSnapshot
    };

    // Mock normalDocsSvc
    spyOn(normalDocsSvc, 'explainDoc').and.callFake(function(doc, explainJson) {
      var normalizedDoc = angular.copy(doc);
      normalizedDoc.explain = function() {
        return { rawStr: function() { return JSON.stringify(explainJson); } };
      };
      return normalizedDoc;
    });
  }));

  describe('createSnapshotSearcher', function() {
    it('should create a searcher with snapshot interface', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      expect(searcher).toBeDefined();
      expect(searcher.type).toBe('snapshot');
      expect(searcher.docs).toEqual(jasmine.any(Array));
      expect(searcher.numFound).toEqual(jasmine.any(Number));
      expect(searcher.search).toEqual(jasmine.any(Function));
      expect(searcher.version).toEqual(jasmine.any(Function));
      expect(searcher.name).toEqual(jasmine.any(Function));
    });

    it('should initialize docs from snapshot data', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      expect(searcher.docs.length).toBe(3);
      expect(searcher.numFound).toBe(3);
      expect(searcher.docs[0].id).toBe('doc1');
      expect(searcher.docs[1].id).toBe('doc2');
      expect(searcher.docs[2].id).toBe('doc3');
    });

    it('should properly handle rated_only flag', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      expect(searcher.docs[0].ratedOnly).toBe(false);
      expect(searcher.docs[1].ratedOnly).toBe(false);
      expect(searcher.docs[2].ratedOnly).toBe(true);
    });

    it('should normalize documents using normalDocsSvc', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      expect(normalDocsSvc.explainDoc).toHaveBeenCalledTimes(3);
      expect(searcher.docs[0].explain).toEqual(jasmine.any(Function));
    });
  });

  describe('search method', function() {
    it('should resolve immediately since snapshot data is pre-loaded', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());
      var resolved = false;

      searcher.search().then(function() {
        resolved = true;
      });

      $rootScope.$apply();
      expect(resolved).toBe(true);
    });

    it('should maintain the same interface as normal searchers', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      // These methods should match the interface expected from splainer-search searchers
      expect(searcher.search).toEqual(jasmine.any(Function));
      expect(searcher.pager).toEqual(jasmine.any(Function));
      expect(searcher.explainOther).toEqual(jasmine.any(Function));
      expect(searcher.version).toEqual(jasmine.any(Function));
    });
  });

  describe('createSearcherFromSnapshot', function() {
    it('should create searcher from snapshot ID', function() {
      var searcher = snapshotSearcherSvc.createSearcherFromSnapshot('snapshot-1', mockQuery, mockSettings);

      expect(searcher).toBeDefined();
      expect(searcher.type).toBe('snapshot');
      expect(searcher.name()).toBe('Test Snapshot');
      expect(searcher.docs.length).toBe(3);
    });

    it('should return null for non-existent snapshots', function() {
      spyOn(console, 'log'); // Suppress error logging in test
      var searcher = snapshotSearcherSvc.createSearcherFromSnapshot('non-existent', mockQuery, mockSettings);

      expect(searcher).toBeNull();
    });
  });

  describe('getFilteredDocs', function() {
    it('should filter docs by rated status', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      var unratedDocs = searcher.getFilteredDocs(false);
      var ratedDocs = searcher.getFilteredDocs(true);

      expect(unratedDocs.length).toBe(2);
      expect(ratedDocs.length).toBe(1);
      expect(unratedDocs[0].id).toBe('doc1');
      expect(unratedDocs[1].id).toBe('doc2');
      expect(ratedDocs[0].id).toBe('doc3');
    });
  });

  describe('unified interface compatibility', function() {
    it('should provide the same interface as normal searchers', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      // Properties that should match splainer-search searchers
      expect(searcher.docs).toEqual(jasmine.any(Array));
      expect(searcher.numFound).toEqual(jasmine.any(Number));
      expect(searcher.type).toEqual(jasmine.any(String));
      expect(searcher.linkUrl).toBeDefined();
      expect(searcher.inError).toBe(false);
      expect(searcher.lastResponse).toBeDefined();

      // Methods that should match splainer-search searchers
      expect(typeof searcher.search).toBe('function');
      expect(typeof searcher.pager).toBe('function');
      expect(typeof searcher.explainOther).toBe('function');
      expect(typeof searcher.version).toBe('function');
      expect(typeof searcher.name).toBe('function');
    });

    it('should work with existing query processing logic', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      // Simulate how Query object uses searchers
      expect(searcher.docs.length).toBeGreaterThan(0);
      expect(searcher.numFound).toEqual(searcher.docs.length);
      
      // Should be able to access docs the same way as normal searchers
      var firstDoc = searcher.docs[0];
      expect(firstDoc.id).toBeDefined();
      expect(firstDoc.hasRating).toEqual(jasmine.any(Function));
      expect(firstDoc.score).toEqual(jasmine.any(Function));
    });
  });

  describe('pagination', function() {
    it('should return null for pager (snapshots do not support pagination)', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());

      expect(searcher.pager()).toBeNull();
    });
  });

  describe('explainOther', function() {
    it('should reject explainOther requests (not supported for snapshots)', function() {
      var searcher = snapshotSearcherSvc.createSnapshotSearcher(mockSnapshot, mockQuery, mockSettings.createFieldSpec());
      var rejected = false;

      searcher.explainOther('test query', 'id title').catch(function(error) {
        rejected = true;
        expect(error).toBe('ExplainOther not supported for snapshots');
      });

      $rootScope.$apply();
      expect(rejected).toBe(true);
    });
  });
});