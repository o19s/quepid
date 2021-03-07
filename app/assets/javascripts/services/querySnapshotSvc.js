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

        return $http.get('/api/cases/' + caseNo + '/snapshots')
          .then(function(response) {
            return addSnapshotResp(response.data.snapshots)
              .then(function() {
                version++;
              });
          });
      };

      this.addSnapshot = function(name, queries) {
        var docs = {};
        angular.forEach(queries, function(query) {
          docs[query.queryId] = [];

          // Save all matches
          angular.forEach(query.docs, function(doc) {
            docs[query.queryId].push({'id': doc.id, 'explain': doc.explain().rawStr(), 'rated_only': false});
          });

          // Save rated only matches
          angular.forEach(query.ratedDocs, function(doc) {
            docs[query.queryId].push({'id': doc.id, 'explain': doc.explain().rawStr(), 'rated_only': true});
          });
        });

        var saved = {
          'snapshot': {
            'name': name,
            'docs': docs,
          }
        };

        return $http.post('/api/cases/' + caseNo + '/snapshots', saved)
          .then(function(response) {
            return addSnapshotResp([response.data])
              .then(function() {
                version++;
              });
          });
      };

      this.deleteSnapshot = function(snapshotId) {
        var url = '/api/cases/' + caseNo + '/snapshots/' + snapshotId;

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

          query.docs.push( { 'id': doc['Doc ID'], 'position': doc['Doc Position'] } );
        });

        function callApi (caseId, snapshotData) {
          var url = '/api/cases/' + caseId + '/snapshots/imports';
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
        var url     = '/api/cases/' + caseNo + '/snapshots/' + snapshotId;

        return $http.get(url)
          .then(function(response) {
            return addSnapshotResp([response.data]);
          });
      }
    }
  ]);
