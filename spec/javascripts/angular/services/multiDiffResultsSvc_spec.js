'use strict';

describe('Service: multiDiffResultsSvc', function () {
  var multiDiffResultsSvc;
  var $q;
  var $rootScope;
  var querySnapshotSvc;
  var settingsSvc;
  var snapshotSearcherSvc;

  var mockSettings = {
    searchUrl: 'http://localhost:8985/solr/collection1/select',
    fieldSpec: {
      'id': { 'title': 'ID', 'field': 'id' },
      'title': { 'title': 'Title', 'field': 'title' }
    }
  };

  var mockSnapshot1 = {
    id: 1,
    name: function() { return 'Snapshot 1'; }
  };

  var mockSnapshot2 = {
    id: 2,
    name: function() { return 'Snapshot 2'; }
  };

  var mockQuery = {
    queryId: 1,
    query_text: 'test query',
    scoreOthers: function(docs) {
      return { score: 0.5, allRated: true };
    }
  };

  var mockSearcher1 = {
    search: function() {
      var deferred = $q.defer();
      deferred.resolve();
      return deferred.promise;
    },
    docs: [
      { id: 'doc1', ratedOnly: false, score: function() { return 0.8; } },
      { id: 'doc2', ratedOnly: false, score: function() { return 0.6; } }
    ],
    name: function() { return 'Snapshot 1'; },
    version: function() { return 1; }
  };

  var mockSearcher2 = {
    search: function() {
      var deferred = $q.defer();
      deferred.resolve();
      return deferred.promise;
    },
    docs: [
      { id: 'doc3', ratedOnly: false, score: function() { return 0.7; } },
      { id: 'doc4', ratedOnly: false, score: function() { return 0.5; } }
    ],
    name: function() { return 'Snapshot 2'; },
    version: function() { return 2; }
  };

  beforeEach(function() {
    module('QuepidApp');
    
    module(function($provide) {
      $provide.value('querySnapshotSvc', {});
      $provide.value('settingsSvc', {
        editableSettings: function() { return mockSettings; }
      });
      $provide.value('snapshotSearcherSvc', {
        createSearcherFromSnapshot: function(snapshotId, query, settings) {
          if (snapshotId === 1) {
            return mockSearcher1;
          } else if (snapshotId === 2) {
            return mockSearcher2;
          }
          return null;
        }
      });
    });

    inject(function (_multiDiffResultsSvc_, _$q_, _$rootScope_, _querySnapshotSvc_, _settingsSvc_, _snapshotSearcherSvc_) {
      multiDiffResultsSvc = _multiDiffResultsSvc_;
      $q = _$q_;
      $rootScope = _$rootScope_;
      querySnapshotSvc = _querySnapshotSvc_;
      settingsSvc = _settingsSvc_;
      snapshotSearcherSvc = _snapshotSearcherSvc_;
    });
  });

  describe('initialization', function() {
    it('should start with empty multi-diff settings', function() {
      expect(multiDiffResultsSvc.getMultiDiffSettings()).toEqual([]);
      expect(multiDiffResultsSvc.isMultiDiffEnabled()).toBe(false);
    });

    it('should return correct max snapshots', function() {
      expect(multiDiffResultsSvc.getMaxSnapshots()).toBe(3);
    });
  });

  describe('setting multi-diff configurations', function() {
    it('should set multi-diff settings', function() {
      var settings = [1, 2];
      multiDiffResultsSvc.setMultiDiffSettings(settings);
      expect(multiDiffResultsSvc.getMultiDiffSettings()).toEqual(settings);
      expect(multiDiffResultsSvc.isMultiDiffEnabled()).toBe(true);
    });

    it('should limit settings to max snapshots', function() {
      var settings = [1, 2, 3, 4]; // 4 snapshots, but max is 3
      multiDiffResultsSvc.setMultiDiffSettings(settings);
      expect(multiDiffResultsSvc.getMultiDiffSettings()).toEqual([1, 2, 3]);
    });

    it('should handle null settings', function() {
      multiDiffResultsSvc.setMultiDiffSettings(null);
      expect(multiDiffResultsSvc.getMultiDiffSettings()).toEqual([]);
      expect(multiDiffResultsSvc.isMultiDiffEnabled()).toBe(false);
    });
  });

  describe('query multi-diff creation', function() {
    beforeEach(function() {
      multiDiffResultsSvc.setMultiDiffSettings([1, 2]);
    });

    it('should create multi-diff for query with valid snapshots', function() {
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
      
      expect(mockQuery.multiDiff).toBeDefined();
      expect(mockQuery.multiDiffSearchers).toBeDefined();
      expect(mockQuery.multiDiffSearchers.length).toBe(2);
    });

    it('should not create multi-diff when no settings', function() {
      multiDiffResultsSvc.setMultiDiffSettings([]);
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
      
      expect(mockQuery.multiDiff).toBe(null);
      expect(mockQuery.multiDiffSearchers).toEqual([]);
    });

    it('should create multi-diff interface with correct methods', function() {
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
      
      expect(mockQuery.multiDiff.fetch).toBeDefined();
      expect(mockQuery.multiDiff.getSearchers).toBeDefined();
      expect(mockQuery.multiDiff.docs).toBeDefined();
      expect(mockQuery.multiDiff.allDocs).toBeDefined();
      expect(mockQuery.multiDiff.name).toBeDefined();
      expect(mockQuery.multiDiff.names).toBeDefined();
      expect(mockQuery.multiDiff.score).toBeDefined();
      expect(mockQuery.multiDiff.type).toBeDefined();
      expect(mockQuery.multiDiff.count).toBeDefined();
    });
  });

  describe('multi-diff interface', function() {
    beforeEach(function() {
      multiDiffResultsSvc.setMultiDiffSettings([1, 2]);
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
    });

    it('should return correct searcher count', function() {
      expect(mockQuery.multiDiff.count()).toBe(2);
    });

    it('should return correct type', function() {
      expect(mockQuery.multiDiff.type()).toBe('multi-snapshot');
    });

    it('should return all searchers', function() {
      var searchers = mockQuery.multiDiff.getSearchers();
      expect(searchers.length).toBe(2);
      expect(searchers[0]).toBe(mockSearcher1);
      expect(searchers[1]).toBe(mockSearcher2);
    });

    it('should return specific searcher by index', function() {
      expect(mockQuery.multiDiff.getSearcher(0)).toBe(mockSearcher1);
      expect(mockQuery.multiDiff.getSearcher(1)).toBe(mockSearcher2);
      expect(mockQuery.multiDiff.getSearcher(2)).toBe(null);
    });

    it('should return docs for specific searcher', function() {
      var docs0 = mockQuery.multiDiff.docs(0);
      var docs1 = mockQuery.multiDiff.docs(1);
      
      expect(docs0.length).toBe(2);
      expect(docs1.length).toBe(2);
      expect(docs0[0].id).toBe('doc1');
      expect(docs1[0].id).toBe('doc3');
    });

    it('should return empty array for invalid searcher index', function() {
      var docs = mockQuery.multiDiff.docs(99);
      expect(docs).toEqual([]);
    });

    it('should return all docs grouped by searcher', function() {
      var allDocs = mockQuery.multiDiff.allDocs();
      
      expect(allDocs.length).toBe(2);
      expect(allDocs[0].searcherIndex).toBe(0);
      expect(allDocs[0].docs.length).toBe(2);
      expect(allDocs[0].name).toBe('Snapshot 1');
      
      expect(allDocs[1].searcherIndex).toBe(1);
      expect(allDocs[1].docs.length).toBe(2);
      expect(allDocs[1].name).toBe('Snapshot 2');
    });

    it('should return combined name for all snapshots', function() {
      var combinedName = mockQuery.multiDiff.name();
      expect(combinedName).toBe('Snapshot 1 vs Snapshot 2');
    });

    it('should return specific name for searcher index', function() {
      var name0 = mockQuery.multiDiff.name(0);
      var name1 = mockQuery.multiDiff.name(1);
      
      expect(name0).toBe('Snapshot 1');
      expect(name1).toBe('Snapshot 2');
    });

    it('should return array of names', function() {
      var names = mockQuery.multiDiff.names();
      expect(names).toEqual(['Snapshot 1', 'Snapshot 2']);
    });

    it('should return version for specific searcher', function() {
      var version0 = mockQuery.multiDiff.version(0);
      var version1 = mockQuery.multiDiff.version(1);
      
      expect(version0).toBe(1);
      expect(version1).toBe(2);
    });

    it('should return all versions when no index specified', function() {
      var versions = mockQuery.multiDiff.version();
      expect(versions).toEqual([1, 2]);
    });
  });

  describe('multi-diff fetching and scoring', function() {
    beforeEach(function() {
      multiDiffResultsSvc.setMultiDiffSettings([1, 2]);
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
    });

    it('should fetch all searchers and calculate scores', function() {
      spyOn(mockSearcher1, 'search').and.callThrough();
      spyOn(mockSearcher2, 'search').and.callThrough();
      spyOn(mockQuery, 'scoreOthers').and.callThrough();

      mockQuery.multiDiff.fetch();
      $rootScope.$apply();

      expect(mockSearcher1.search).toHaveBeenCalled();
      expect(mockSearcher2.search).toHaveBeenCalled();
      expect(mockQuery.scoreOthers).toHaveBeenCalledTimes(2);
    });

    it('should return score for specific searcher', function() {
      mockSearcher1.diffScore = { score: 0.8, allRated: true };
      
      mockQuery.multiDiff.score(0).then(function(score) {
        expect(score.score).toBe(0.8);
        expect(score.allRated).toBe(true);
      });
      
      $rootScope.$apply();
    });

    it('should return all scores when no index specified', function() {
      mockSearcher1.diffScore = { score: 0.8, allRated: true };
      mockSearcher2.diffScore = { score: 0.6, allRated: false };
      
      mockQuery.multiDiff.score().then(function(scores) {
        expect(scores.length).toBe(2);
        expect(scores[0].score).toBe(0.8);
        expect(scores[1].score).toBe(0.6);
      });
      
      $rootScope.$apply();
    });
  });

  describe('edge cases', function() {
    it('should handle invalid snapshot searchers gracefully', function() {
      multiDiffResultsSvc.setMultiDiffSettings([99, 100]); // Invalid snapshot IDs
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
      
      expect(mockQuery.multiDiff).toBe(null);
      expect(mockQuery.multiDiffSearchers).toEqual([]);
    });

    it('should handle mixed valid and invalid snapshots', function() {
      multiDiffResultsSvc.setMultiDiffSettings([1, 99]); // One valid, one invalid
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
      
      expect(mockQuery.multiDiff).toBeDefined();
      expect(mockQuery.multiDiffSearchers.length).toBe(1);
      expect(mockQuery.multiDiff.count()).toBe(1);
    });

    it('should handle empty docs array', function() {
      mockSearcher1.docs = [];
      multiDiffResultsSvc.setMultiDiffSettings([1]);
      multiDiffResultsSvc.createQueryMultiDiff(mockQuery);
      
      var docs = mockQuery.multiDiff.docs(0);
      expect(docs).toEqual([]);
    });
  });
});