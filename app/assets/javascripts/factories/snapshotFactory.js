'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('SnapshotFactory', [
      '$log',
      '$filter',
      'docCacheSvc',
      'normalDocsSvc',
      SnapshotFactory
  ]);

  function SnapshotFactory($log, $filter, docCacheSvc, normalDocsSvc) {
    var Snapshot = function(params) {
      var self  = this;

      self.id   = params.id;
      self.name = snapshotName;
      self.time = params.time;
      self.hasSnapshotFile = params.has_snapshot_file;
      self.docs = params.docs;
      self.queries = params.queries;

      self.allDocIds        = allDocIds;
      self.getSearchResults = getSearchResults;
      
      self.docIdsPerQuery   = {};
      
      // Map from snake_case to camelCase.
      angular.forEach(self.queries, function(query) {
        query.queryId = query.query_id;
        delete query.query_id;
        query.queryText = query.query_text;
        delete query.query_text;
      });

      angular.forEach(self.docs, function(docs, queryId) {
        self.docIdsPerQuery[queryId] = [];

        angular.forEach(docs, function(doc) {
          self.docIdsPerQuery[queryId].push(doc.id);
        });
      });

      function snapshotName () {
        return '(' + $filter('date')(params.time, 'shortDate') + ') ' + params.name;
      }

      function allDocIds () {
        var docIds = {};

        angular.forEach(self.docIdsPerQuery, function loopBody(qDocIds) {
          angular.forEach(qDocIds, function loopInnerBody(docId) {
            docIds[docId] = null;
          });
        });

        return Object.keys(docIds);
      }

      function getSearchResults (queryId, fieldSpec) {
        if (angular.isUndefined(self.docs) || self.docs === null) {
          return;
        }

        // fetch from the backend
        var qDocs         = self.docs[queryId];
        var searchResults = [];

        angular.forEach(qDocs, function loopBody(sDoc) {
          var doc;
          
          // Check if fields are saved in the snapshot (for custom search endpoints)
          if (sDoc.fields) {
            // Use the saved fields directly - they contain all the field data
            doc = angular.copy(sDoc.fields);
            doc.id = sDoc.id;
          } else {
            // Fall back to fetching from docCache (for regular Solr/ES endpoints)
            doc = docCacheSvc.getDoc(sDoc.id);
          }

          if (sDoc === null) {
            $log.debug('sDoc is null, and we do not expect it');
          }

          if (doc === null) {
            $log.debug('Document with id ' + sDoc.id + ' is null');
          }

          // only run this if we have documents, sometimes we don't because of
          // a bad query to the back end.
          if (doc != null) {
            // Use normalDocsSvc.createNormalDoc to properly create a document with all methods
            // This handles the full pipeline: NormalDoc creation -> explainDoc -> snippetDoc
            var explAsJson = angular.fromJson(sDoc.explain);
            var nDoc;
            
            if (fieldSpec) {
              // Full normalization with fieldSpec (for saved fields or regular docs)
              nDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, explAsJson);
            } else {
              // Fallback for backward compatibility if fieldSpec not provided
              nDoc = normalDocsSvc.explainDoc(doc, explAsJson);
              nDoc = normalDocsSvc.snippetDoc(nDoc);
            }
            
            // Apply rated only for filtering
            nDoc.rated_only = sDoc.rated_only;

            searchResults.push(nDoc);
          }
        });

        return searchResults;
      }
    };

    // Return factory object
    return Snapshot;
  }
})();
