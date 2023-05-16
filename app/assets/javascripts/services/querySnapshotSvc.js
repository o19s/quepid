'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('querySnapshotSvc', [
    '$http', '$q',
    'settingsSvc', 'docCacheSvc', 'normalDocsSvc',
    'SnapshotFactory',
    function querySnapshotSvc(
      $http, $q,
      settingsSvc, docCacheSvc, normalDocsSvc,
      SnapshotFactory
    ) {
      // caches normal docs for all snapshots
      // TODO invalidation

      var svc       = this;
      var caseNo    = -1;
      var version   = 0;
      svc.snapshots = {};
      svc.getCaseNo = function(){
        return caseNo;
      };

      svc.importSnapshots = importSnapshots;
      svc.importSnapshotsToSpecificCase = importSnapshotsToSpecificCase;
      svc.get             = get;

      var addSnapshotResp = function(snapshots) {
        angular.forEach(snapshots, function(snapshot) {
          // locally store snapshot data
          var snapObj = new SnapshotFactory(snapshot);
          svc.snapshots[snapshot.id] = snapObj;
          docCacheSvc.addIds(snapObj.allDocIds());
        });
        var settings = settingsSvc.editableSettings();

        if ( !(angular.isUndefined(settings) ||
            settings === null ||
            Object.keys(settings).length === 0)
        ) {
          return docCacheSvc.update(settings);
        } else {
          return $q(function(resolve) {
            resolve();
          });
        }
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

      this.addSnapshot = function(name, recordDocumentFields, queries) {
        // we may want to refactor the payload structure in the future.
        var docs = {};
        var queriesPayload = {};
        angular.forEach(queries, function(query) {
          queriesPayload[query.queryId] = {
            'score': query.currentScore.score,
            'all_rated': query.currentScore.allRated,
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
            return addSnapshotResp([response.data])
              .then(function() {
                version++;
              });
          });
      };

      this.deleteSnapshot = function(snapshotId) {
        var url = 'api/cases/' + caseNo + '/snapshots/' + snapshotId;

        return $http.delete(url)
          .then(function() {
            var snapshotIdStr = '' + snapshotId;
            delete svc.snapshots[snapshotIdStr];
            version++;
          });
      };

      this.version = function() {
        return version;
      };

      function importSnapshotsToSpecificCase(docs, targetCaseNo) {
        let docs2 = docs;
        console.log('js 923847598w74987');
        angular.forEach(docs2, function(doc) {
          doc['Case ID'] = targetCaseNo;
        });
        console.log('js 3049578398475');
        return importSnapshots(docs2);
      }

      function importSnapshots (docs) {
        console.log('js 439879837459');
        var cases = {};
        console.log('js 2309487698958');
        angular.forEach(docs, function(doc) {
          console.log('js 3548793847598');
          if( !angular.isDefined(cases[doc['Case ID']]) ) {
            cases[doc['Case ID']] = { 'snapshots': {} };
          }
          console.log('js 35487938475980398745698374');
          var aCase = cases[doc['Case ID']];
          console.log('js 30539475987');
          if( !angular.isDefined(aCase.snapshots[doc['Snapshot Name']]) ) {
            var time = doc['Snapshot Time'];
            aCase.snapshots[doc['Snapshot Name']] = {
              queries:      {},
              created_time: time,
              name:         doc['Snapshot Name']
            };
          }

          var snapshot = aCase.snapshots[doc['Snapshot Name']];
          console.log('js 4857349578');
          if( !angular.isDefined(snapshot.queries[doc['Query Text']]) ) {
            snapshot.queries[doc['Query Text']] = { 'docs': [] };
          }
          console.log('js 3045973409857');
          var query = snapshot.queries[doc['Query Text']];
          console.log('js 30497853498567');
          query.docs.push( { 'id': doc['Doc ID'], 'position': doc['Doc Position'] } );
          console.log('js 98637954876552');
        });
        console.log('js 30495679863759');
        function callApi (caseId, snapshotData) {
          var url = 'api/cases/' + caseId + '/snapshots/imports';
          console.log('js 30495679863759');
          return $http.post(url, { snapshots: [snapshotData] })
            .then(function(response) {
              console.log('js o3874567987495');
              return addSnapshotResp(response.data.snapshots);
            });
        }

        var deferred  = $q.defer();
        var promises  = [];
        console.log('js 03976598475698');
        angular.forEach(cases, function(caseData, caseId) {
          angular.forEach(caseData.snapshots, function(snapshot) {
            promises.push(callApi(caseId, snapshot));
          });
        });
        console.log('js 034985769485769');
        $q.all(promises)
          .then(function() {
            console.log('js 49857694857698');
            deferred.resolve('Snapshots imported.');
          }, function(message) {
            console.log('js 405396798457698');
            deferred.reject(message);
          });
        console.log('js 398679485769485679');
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
