'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('querySnapshotSvc', [
    '$http', '$q', '$injector', '$filter',
    'settingsSvc', 'docCacheSvc', 'caseTryNavSvc', 'fieldSpecSvc', 'normalDocsSvc',
    function querySnapshotSvc(
      $http, $q, $injector, $filter,
      settingsSvc, docCacheSvc, caseTryNavSvc, fieldSpecSvc, normalDocsSvc
    ) {
      // caches normal docs for all snapshots
      // TODO invalidation

      var svc       = this;
      var snapshotSearch = window.quepidSearch.snapshotSearch;
      var caseNo    = -1;
      var version   = 0;
      svc.snapshots = {};
      svc.getCaseNo = function(){
        return caseNo;
      };

      svc.importSnapshots = importSnapshots;
      svc.importSnapshotsToSpecificCase = importSnapshotsToSpecificCase;
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
        // we may want to refactor the payload structure in the future.
        var docs = {};
        var queriesPayload = {};
        angular.forEach(queries, function(query) {
          var currentScore = query.currentScore || {};
          queriesPayload[query.queryId] = {
            'score': currentScore.score === undefined ? null : currentScore.score,
            'all_rated': currentScore.allRated || false,
            'number_of_results': query.numFound
          };

          // The score can be -- if it hasn't actually been scored, so convert
          // that to null for the call to the backend.
          if (queriesPayload[query.queryId].score === '--') {
            queriesPayload[query.queryId].score = null;
          }

          docs[query.queryId] = [];

          // Save all matches
          angular.forEach(query.docs, function(doc) {

            var docPayload = {'id': doc.id, 'explain': doc.explain().rawStr(), 'rated_only': false};
            if (recordDocumentFields) {
              var fields = {};
              angular.forEach(Object.values(doc.subsList), function(field) {
                fields[field['field']] = field['value'];
              });
              fields[doc.titleField] = doc.title;

              docPayload['fields'] = fields;
            }

            docs[query.queryId].push(docPayload);

          });

          // Save rated only matches
          angular.forEach(query.ratedDocs, function(doc) {
            var docPayload = {'id': doc.id, 'explain': doc.explain().rawStr(), 'rated_only': true};

            if (recordDocumentFields) {
              var fields = {};
              angular.forEach(Object.values(doc.subsList), function(field) {
                fields[field['field']] = field['value'];
              });

              docPayload['fields'] = fields;
            }
            docs[query.queryId].push(docPayload);
          });
        });

        var saved = {
          'snapshot': {
            'name': name,
            'docs': docs,
            'queries': queriesPayload
          }
        };

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

      function importSnapshotsToSpecificCase(docs, targetCaseNo) {
        let docsWithCaseOverridden = docs;
        angular.forEach(docsWithCaseOverridden, function(doc) {
          doc['Case ID'] = targetCaseNo;
        });
        return importSnapshots(docsWithCaseOverridden);
      }

      function importSnapshots (docs) {
        var cases = {};

        angular.forEach(docs, function(doc) {
          if( !angular.isDefined(cases[doc['Case ID']]) ) {
            cases[doc['Case ID']] = { 'snapshots': {} };
          }

          var aCase = cases[doc['Case ID']];

          if( !angular.isDefined(aCase.snapshots[doc['Snapshot Name']]) ) {
            var time = doc['Snapshot Time'];
            aCase.snapshots[doc['Snapshot Name']] = {
              queries:      {},
              created_time: time,
              name:         doc['Snapshot Name']
            };
          }

          var snapshot = aCase.snapshots[doc['Snapshot Name']];

          if( !angular.isDefined(snapshot.queries[doc['Query Text']]) ) {
            snapshot.queries[doc['Query Text']] = { 'docs': [] };
          }

          var query = snapshot.queries[doc['Query Text']];
          
          var docPayload = { 'id': doc['Doc ID'], 'position': doc['Doc Position'] };
          
          // Remove the properties of the doc that exist elsewhere.
          delete doc['Doc ID'];
          delete doc['Doc Position'];
          
          delete doc['Snapshot Name'];
          delete doc['Snapshot Time'];
          delete doc['Case ID'];
          delete doc['Query Text'];
          
          // map any remaining properties of the doc as fields.
          docPayload['fields'] = doc;

          query.docs.push(docPayload );
        });

        function callApi (caseId, snapshotData) {
          var url = 'api/cases/' + caseId + '/snapshots/imports';
          return $http.post(url, { snapshots: [snapshotData] })
            .then(function(response) {
              return addSnapshotResp(response.data.snapshots);
            });
        }

        var deferred  = $q.defer();
        var promises  = [];

        angular.forEach(cases, function(caseData, caseId) {
          angular.forEach(caseData.snapshots, function(snapshot) {
            promises.push(callApi(caseId, snapshot));
          });
        });

        $q.all(promises)
          .then(function() {
            deferred.resolve('Snapshots imported.');
          }, function(message) {
            deferred.reject(message);
          });

        return deferred.promise;
      }

      function get(snapshotId) {
        var url     = 'api/cases/' + caseNo + '/snapshots/' + snapshotId+ '?shallow=true';

        return $http.get(url)
          .then(function(response) {
            return addSnapshotResp([response.data]);
          });
      }
    }
  ]);
