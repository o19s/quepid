'use strict';

/*
 * SnapshotSearcher - Provides a searcher interface compatible with normal searchers
 * but fetches results from snapshot data instead of a live search engine.
 * 
 * This allows snapshot results to be handled using the same patterns as normal
 * search results, making the codebase more consistent.
 */
angular.module('QuepidApp')
  .service('snapshotSearcherSvc', [
    '$q',
    '$log',
    'querySnapshotSvc',
    'normalDocsSvc',
    function snapshotSearcherSvc(
      $q,
      $log,
      querySnapshotSvc,
      normalDocsSvc
    ) {

      // SnapshotSearcher implements the same interface as splainer-search searchers
      var SnapshotSearcher = function(snapshot, query, fieldSpec) {
        var self = this;
        
        self.snapshot = snapshot;
        self.query = query;
        self.fieldSpec = fieldSpec;
        self.type = 'snapshot';
        
        // Properties that match normal searcher interface
        self.docs = [];
        self.numFound = 0;
        self.linkUrl = null;
        self.inError = false;
        self.searchError = null;
        self.lastResponse = null;

        // A query whose server-side extraction failed (e.g. a Search API mapper that
        // threw) is a real error, not a legitimate zero-result query - surface it the
        // same way a live search failure would be, instead of silently showing 0 docs.
        // getQueryError is guarded since callers may pass any snapshot-like object that
        // implements just getSearchResults/name (see the "searcher interface" contract
        // at the top of this file).
        var queryError = angular.isFunction(self.snapshot.getQueryError) ?
          self.snapshot.getQueryError(self.query.queryId) :
          null;
        if (queryError) {
          self.inError = true;
          self.searchError = queryError;
        }

        // Initialize docs from snapshot
        self._initializeDocs();
      };

      SnapshotSearcher.prototype._initializeDocs = function() {
        var self = this;
        self.docs.length = 0;
        
        var savedSearchResults = self.snapshot.getSearchResults(self.query.queryId);
        if (!savedSearchResults) {
          self.numFound = 0;
          return;
        }

        self.numFound = savedSearchResults.length;

        angular.forEach(savedSearchResults, function(doc) {
          if (angular.isDefined(doc) && doc !== null) {
            var rateableDoc = self.query.ratingsStore.createRateableDoc(doc);
            rateableDoc.ratedOnly = doc.rated_only ? doc.rated_only : false;
            
            // Normalize the document using the same process as normal searchers
            var explAsJson = angular.fromJson(doc.explain);
            var normalizedDoc = normalDocsSvc.explainDoc(rateableDoc, explAsJson);
            
            self.docs.push(normalizedDoc);
          }
        });
      };

      // Main search method - for snapshots this just resolves immediately
      // since the data is already loaded
      SnapshotSearcher.prototype.search = function() {
        return $q(function(resolve) {
          // Snapshot data is already loaded, so we just resolve
          // This maintains compatibility with the normal searcher interface
          resolve();
        });
      };

      // Pagination support - snapshots don't typically paginate
      SnapshotSearcher.prototype.pager = function() {
        // For now, snapshots don't support pagination
        // Return null to indicate no more pages (same as normal searchers)
        return null;
      };

      // Explain other method - not typically used for snapshots
      SnapshotSearcher.prototype.explainOther = function(queryText, fieldSpec) {
        /*jshint unused:false */
        var deferred = $q.defer();
        
        // Snapshots don't support arbitrary queries, so we reject
        deferred.reject('ExplainOther not supported for snapshots');
        
        return deferred.promise;
      };

      // Get the name of this searcher (for display purposes)
      SnapshotSearcher.prototype.name = function() {
        return this.snapshot.name();
      };

      // Version tracking for change detection
      SnapshotSearcher.prototype.version = function() {
        return this.query.version();
      };

      // Filter docs by rated status (matches normal searcher behavior)
      SnapshotSearcher.prototype.getFilteredDocs = function(onlyRated) {
        onlyRated = onlyRated || false;
        return this.docs.filter(function(doc) {
          return doc.ratedOnly === onlyRated;
        });
      };

      // Service methods
      this.createSnapshotSearcher = function(snapshot, query, fieldSpec) {
        return new SnapshotSearcher(snapshot, query, fieldSpec);
      };

      // Factory function similar to how normal searchers are created
      this.createSearcherFromSnapshot = function(snapshotId, query, settings) {
        var snapshot = querySnapshotSvc.snapshots[snapshotId];
        
        if (!snapshot) {
          $log.error('Snapshot not found:', snapshotId);
          return null;
        }
        
        var fieldSpec = settings ? settings.createFieldSpec() : null;
        return new SnapshotSearcher(snapshot, query, fieldSpec);
      };
    }
  ]);