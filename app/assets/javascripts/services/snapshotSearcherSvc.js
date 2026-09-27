'use strict';

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
      var createSnapshotSearcher = window.quepidSearch.snapshotSearch.createSnapshotSearcher;

      this.createSnapshotSearcher = function(snapshot, query, fieldSpec) {
        return createSnapshotSearcher({
          snapshot: snapshot,
          query: query,
          fieldSpec: fieldSpec,
          createRateableDoc: function(doc) {
            return query.ratingsStore.createRateableDoc(doc);
          },
          explainDoc: function(doc, explain) {
            return normalDocsSvc.explainDoc(doc, explain);
          },
          promiseApi: $q
        });
      };

      this.createSearcherFromSnapshot = function(snapshotId, query, settings) {
        var snapshot = querySnapshotSvc.snapshots[snapshotId];

        if (!snapshot) {
          $log.error('Snapshot not found:', snapshotId);
          return null;
        }

        var fieldSpec = settings ? settings.createFieldSpec() : null;
        return this.createSnapshotSearcher(snapshot, query, fieldSpec);
      };
    }
  ]);
