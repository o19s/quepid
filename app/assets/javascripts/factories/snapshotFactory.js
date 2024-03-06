'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('SnapshotFactory', [
      '$log',
      'docCacheSvc',
      'normalDocsSvc',
      SnapshotFactory
  ]);

  function SnapshotFactory($log, docCacheSvc, normalDocsSvc) {
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
      self.timestamp        = timestamp;

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
        return 'Snapshot: ' + params.name;
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

      function getSearchResults (queryId) {
        if (angular.isUndefined(self.docs) || self.docs === null) {
          return;
        }

        // fetch from the backend
        var qDocs         = self.docs[queryId];
        var searchResults = [];
        console.log("for queryId " + queryId + " we got qdocs:")
        console.log(qDocs)
        
        angular.forEach(qDocs, function loopBody(sDoc) {
          var doc = docCacheSvc.getDoc(sDoc.id);

          if (sDoc === null) {
            $log.debug('sDoc is null, and we do not expect it');
          }

          if (doc === null) {
            $log.debug('Document with id ' + sDoc.id + ' is null');
          }

          // only run this if we have documents, sometimes we don't because of
          // a bad query to the back end.
          if (doc != null) {
            // Apply rated only for filtering
            doc.explain = sDoc.explain;
            doc.rated_only = sDoc.rated_only;

            var explAsJson  = angular.fromJson(doc.explain);
            var nDoc = angular.copy(doc);
            nDoc = normalDocsSvc.explainDoc(nDoc, explAsJson);

            searchResults.push(nDoc);
          }
        });

        return searchResults;
      }

      function timestamp () {
        var date    = new Date(self.time * 1000);

        var hour    = date.getHours();
        var minutes = date.getMinutes();
        var year    = date.getFullYear();
        var day     = date.getDate();

        var months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var month   = months[date.getMonth()];

        if (minutes < 10) {
          minutes = '0' + ('' + minutes);
        }

        return day + '-' + month + '-' + year + ' ' + hour + ':' + minutes;
      }
    };

    // Return factory object
    return Snapshot;
  }
})();
