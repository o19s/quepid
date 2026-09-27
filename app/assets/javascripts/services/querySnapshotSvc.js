'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('querySnapshotSvc', [
    '$http', '$q', '$injector', '$filter',
    'settingsSvc', 'caseTryNavSvc', 'fieldSpecSvc', 'normalDocsSvc',
    function querySnapshotSvc(
      $http, $q, $injector, $filter,
      settingsSvc, caseTryNavSvc, fieldSpecSvc, normalDocsSvc
    ) {
      // caches normal docs for all snapshots
      // TODO invalidation

      var svc       = this;
      var snapshotSearch = window.quepidSearch.snapshotSearch;
      var snapshotPayload = window.quepidSearch.snapshotPayload;
      var docCacheSvc = window.quepidSearch.docCache;
      docCacheSvc.setResolver(function(ids, settings, batchSize) {
        return $injector.get('docResolverSvc').createResolver(ids, settings, batchSize);
      });
      docCacheSvc.empty();
      var caseNo    = -1;
      var version   = 0;
      svc.snapshots = {};
      svc.getCaseNo = function(){
        return caseNo;
      };

      svc.get             = get;
      svc.mapFieldSpecToSolrFormat = mapFieldSpecToSolrFormat;
      svc.registerSnapshots = function(snapshots) { return addSnapshotResp(snapshots); };
      svc.removeSnapshot = function(snapshotId) {
        delete svc.snapshots['' + snapshotId];
        version++;
      };

      // Stimulus take-snapshot-core: modal collects name/options; this builds the
      // payload from live queriesSvc results until the live-query-state migration.
      // Lazy $injector.get avoids a circular DI
      // (queriesSvc ← querySnapshotSvc).
      document.addEventListener('take-snapshot:create', function(event) {
        var detail = event.detail || {};
        if (Number(detail.caseId) !== Number(svc.getCaseNo())) {
          if (detail.done) { detail.done('case mismatch'); }
          return;
        }

        var queriesSvc = $injector.get('queriesSvc');
        svc.addSnapshot(detail.name, detail.recordDocumentFields, queriesSvc.queryArray(), true)
          .then(function() {
            window.quepidDom.flash.show('success', 'Snapshot created successfully.');
            if (detail.done) { detail.done(null); }
          }, function(response) {
            var message = (response && response.data && response.data.statusText) ||
              (response && response.statusText) ||
              'error';
            if (detail.done) { detail.done(message); }
          });
      });

      function mapFieldSpecToSolrFormat(fieldSpec) {
        return snapshotSearch.mapFieldSpecToSolrFormat(fieldSpec);
      }

      var addSnapshotResp = function(snapshots, deferHydration) {
        var snapshotList = [];
        var settings = settingsSvc.editableSettings();
        var useSnapshotScopedCache = !(angular.isUndefined(settings) ||
          settings === null ||
          Object.keys(settings).length === 0) &&
          (settings.searchEngine === 'static' || settingsSvc.supportLookupById(settings.searchEngine) === false);
        angular.forEach(snapshots, function(snapshot) {
          snapshotList.push(snapshot);
        });

        var hydration = snapshotSearch.registerAndHydrateSnapshots({
          snapshots: snapshotList,
          registry: svc.snapshots,
          settings: settings,
          supportsLookupById: settingsSvc.supportLookupById,
          createFieldSpec: fieldSpecSvc.createFieldSpec,
          rootUrl: caseTryNavSvc.getQuepidRootUrl(),
          caseNo: caseTryNavSvc.getCaseNo(),
          addDocIds: docCacheSvc.addIds,
          addScopedDocIds: function(ids, scope) { docCacheSvc.addIds(ids, scope); },
          clearScopedDocs: function(scope) { docCacheSvc.empty(scope); },
          updateDocs: function(hydrationSettings, scope) {
            return docCacheSvc.update(hydrationSettings, scope);
          },
          createModel: function(options) {
            var getDoc = options.getDoc;
            if (useSnapshotScopedCache) {
              getDoc = function(id) {
                return docCacheSvc.getDoc(id, options.params.id);
              };
            }
            return snapshotSearch.createSnapshotModel({
              params: options.params,
              getDoc: getDoc,
              explainDoc: options.explainDoc,
              formatDate: options.formatDate,
              log: options.log
            });
          },
          getDoc: docCacheSvc.getDoc,
          explainDoc: normalDocsSvc.explainDoc,
          formatDate: function(time) { return $filter('date')(time, 'shortDate'); },
          log: function(message) { console.debug(message); },
          promiseApi: $q
        });
        return deferHydration ? $q.when() : hydration.promise;
      };

      this.bootstrap = function(newCaseNo) {
        if (newCaseNo === caseNo) {
          return;
        }

        caseNo = newCaseNo;
        this.snapshots = {};

        return $http.get('api/cases/' + caseNo + '/snapshots?shallow=true')
          .then(function(response) {
            return addSnapshotResp(response.data.snapshots)
              .then(function() {
                version++;
              });
          });
      };
      
      // Snapshots are processed asynchronously, so a cached list can go stale;
      // always re-fetch from the server rather than caching.
      this.getSnapshots = function() {
        this.snapshots = {};

        return $http.get('api/cases/' + caseNo + '/snapshots?shallow=true')
          .then(function(response) {
            return addSnapshotResp(response.data.snapshots)
              .then(function() {
                version++;
              });
          });
      };

      this.addSnapshot = function(name, recordDocumentFields, queries, deferHydration) {
        var saved = snapshotPayload.build(name, recordDocumentFields, queries);

        return $http.post('api/cases/' + caseNo + '/snapshots', saved)
          .then(function(response) {
            return addSnapshotResp([response.data], deferHydration)
              .then(function() {
                version++;
              });
          });
      };

      this.deleteSnapshot = function(snapshotId) {
        var url = 'api/cases/' + caseNo + '/snapshots/' + snapshotId;

        return $http.delete(url)
          .then(function() {
            svc.removeSnapshot(snapshotId);
          });
      };

      this.version = function() {
        return version;
      };

      function get(snapshotId) {
        var url     = 'api/cases/' + caseNo + '/snapshots/' + snapshotId+ '?shallow=true';

        return $http.get(url)
          .then(function(response) {
            return addSnapshotResp([response.data]);
          });
      }
    }
  ]);
