'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('querySnapshotSvc', [
    '$http', '$q',
    'settingsSvc', 'docCacheSvc', 'caseTryNavSvc', 'fieldSpecSvc',
    'SnapshotFactory',
    function querySnapshotSvc(
      $http, $q,
      settingsSvc, docCacheSvc, caseTryNavSvc, fieldSpecSvc,
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
      svc.mapFieldSpecToSolrFormat = mapFieldSpecToSolrFormat;
      svc.ensureFullSnapshot = ensureFullSnapshot;
      
      svc.reset = reset;
      function reset() {
        svc.snapshots = {};       
      }
      
      function mapFieldSpecToSolrFormat(fieldSpec) {
        let convertedfieldSpec = fieldSpec.replace(/id:_([^,]+)/, 'id:$1');
        return convertedfieldSpec;
      }

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
          
          // Some search endpoints let you look up the documents by an id
          // however if that isnt' possible, then we require you to store the doc fields
          // in the snapshot, and we look them up from the Snapshot.  To be clever
          // we pretend to be a "solr'" endpoint to drive the lookup.          
          if (snapshots.length > 0 ) {
            if (settingsSvc.supportLookupById(settings.searchEngine) === false){
              var settingsForLookup  = angular.copy(settings);
              settingsForLookup.apiMethod = 'GET';
              settingsForLookup.searchEngine = 'solr';
  
              let solrSpecificFieldSpecStr =  svc.mapFieldSpecToSolrFormat(settingsForLookup.fieldSpec);
              settingsForLookup.fieldSpec = fieldSpecSvc.createFieldSpec(solrSpecificFieldSpecStr);
              settingsForLookup.searchEndpointId = null;
              settingsForLookup.customHeaders = null;
              
              let snapshotId = snapshots[0].id;
              settingsForLookup.searchUrl = `${caseTryNavSvc.getQuepidRootUrl()}/api/cases/${caseTryNavSvc.getCaseNo()}/snapshots/${snapshotId}/search`;
              
              settings = settingsForLookup;
            }
          }
                    
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
      
      // Now that we process snapshots async, we 
      // don't want to cache the data
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

      this.addSnapshot = function(name, recordDocumentFields, queries, tryNumber) {
        // we may want to refactor the payload structure in the future.
        var docs = {};
        var queriesPayload = {};
        angular.forEach(queries, function(query) {
          queriesPayload[query.queryId] = {
            'number_of_results': query.numFound
          };
          
          // Calculating the currentScore is async process, so it may not 
          // have been completed when it's time to add the snapshot.  
          // Should we look at this and only addSnapshot after calculating scores?
          // Or not worry about it because we re run score when we load the snapshot
          if (query.currentScore) {
            queriesPayload[query.queryId].score = query.currentScore.score;
            queriesPayload[query.queryId].all_rated = query.currentScore.allRated;
          }

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

        // Add try_number to the payload if provided
        if (tryNumber !== undefined && tryNumber !== null) {
          saved.snapshot.try_number = tryNumber;
        }

        return $http.post('api/cases/' + caseNo + '/snapshots', saved)
          .then(function(response) {
            return addSnapshotResp([response.data])
              .then(function() {
                version++;
                // Return the snapshot data so it can be used by the caller
                return response.data;
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
        var url = 'api/cases/' + caseNo + '/snapshots/' + snapshotId;

        return $http.get(url)
          .then(function(response) {
            return addSnapshotResp([response.data]);
          });
      }
      
      /**
       * Ensures that a full snapshot with complete data structure is available
       * If snapshot is not available or only has shallow data, fetches the complete snapshot
       * Returns a promise that resolves to the full snapshot
       */
      function ensureFullSnapshot(snapshotId) {
        var snapshotIdStr = '' + snapshotId; // Ensure we have a string ID
        
        // Check if we have the snapshot at all and if it has docs
        if (svc.snapshots[snapshotIdStr] && svc.snapshots[snapshotIdStr].docs) {
          console.log('Using cached snapshot ' + snapshotIdStr);
          return $q.when(svc.snapshots[snapshotIdStr]);
        }
        
        // If we don't have it or it doesn't have docs, fetch it
        console.log('Fetching full snapshot ' + snapshotIdStr);
        return get(snapshotIdStr).then(function() {
          return svc.snapshots[snapshotIdStr];
        });
      }
    }
  ]);
