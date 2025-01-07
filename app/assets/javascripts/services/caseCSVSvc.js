'use strict';

/**
 *
 * Service to turn scoring data for a case into CSV format.
 *
 * Inspired by https://github.com/asafdav/ng-csv/blob/master/src/ng-csv/services/csv-service.js
 *
 */

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .service('caseCSVSvc', [
      '$http',
      '$filter',
      'queriesSvc',
      function($http, $filter, queriesSvc) {
        var self          = this;
        var EOL           = '\r\n';
        var textDelimiter = '"';

        self.caseHeaderToCSV            = caseHeaderToCSV;
        self.detailedQueriesHeaderToCSV = detailedQueriesHeaderToCSV;
        self.queriesHeaderToCSV         = queriesHeaderToCSV;
        self.snapshotHeaderToCSV        = snapshotHeaderToCSV;
        self.stringify                  = stringify;
        self.stringifyQueries           = stringifyQueries;
        self.exportBasicFormat          = exportBasicFormat;
        self.exportBasicFormatSnapshot  = exportBasicFormatSnapshot;
        self.exportTrecFormat           = exportTrecFormat;
        self.exportTrecFormatSnapshot   = exportTrecFormatSnapshot;
        self.exportQuepidFormat         = exportQuepidFormat;
        self.exportRREFormat            = exportRREFormat;
        self.exportLTRFormat            = exportLTRFormat;
        self.exportInformationNeed      = exportInformationNeed;
        self.stringifyQueriesDetailed   = stringifyQueriesDetailed;
        self.stringifySnapshot          = stringifySnapshot;
        self.formatDownloadFileName     = formatDownloadFileName;
        self.arrayContains              = arrayContains;
        self.fixObjectKeys              = fixObjectKeys;

        function caseHeaderToCSV () {
          var header = [
            'Team Name',
            'Case Name',
            'Case ID',
            'Query Text',
            'Score',
            'Date Last Scored',
            'Count',
            'Information Need',
            'Notes',
            'Options'
          ];

          var headerString = header.join(',');

          return '' + headerString + EOL;
        }

        function queriesHeaderToCSV () {
          var header = [
            'query',
            'doc_id',
            'rating',
          ];

          var headerString = header.join(',');

          return '' + headerString + EOL;
        }

        function detailedQueriesHeaderToCSV (fieldList) {
          var header = [
            'Team Name',
            'Case Name',
            'Case ID',
            'Query Text',
            'Doc ID',
            'Doc Position',
            'Title',
            'Rating',
          ];

          angular.forEach(fieldList, function(fieldName) {
            header.push(fieldName);
          });

          var headerString = header.join(',');

          return '' + headerString + EOL;
        }

        function snapshotHeaderToCSV (fieldList) {
          var header = [
            'Snapshot Name',
            'Snapshot Time',
            'Case ID',
            'Query Text',
            'Doc ID',
            'Doc Position',
          ];
          
          angular.forEach(fieldList, function(fieldName) {
            header.push(fieldName);
          });

          var headerString = header.join(',');

          return '' + headerString + EOL;
        }

        /**
         * Creates CSV string of case from a case object
         *
         * @param aCase
         *
         */
        function stringify (aCase, queries, withHeader) {
          // queries is sourced from queriesSvc.queries for query info and
          // aCase.lastScore.queries has the scoring info for the queries.
          var csvContent  = '';

          if (withHeader) {
            csvContent += self.caseHeaderToCSV();
          }

          if (aCase.lastScore === undefined || aCase.lastScore === null) {
            return csvContent;
          }

          angular.forEach(aCase.lastScore.queries, function (data, id) {
            var dataString, infoArray;
            var score = data.score;
            var text  = data.text;
            var count = data.numFound;

            id = parseInt(id,10); // Convert from string
            
            var query = null;
            angular.forEach(queries, function (data, queryId) {
              if (parseInt(queryId,10) === id){
                query = data;
                return false;
              }
            });

            var notes = query.notes || null;
            var informationNeed = query.informationNeed || null;
            var options = query.options || null;
            
            if (Object.keys(options).length === 0){
              options = null; // blank out boiler plate options json.
            }

            infoArray = [];

            infoArray.push(stringifyField(aCase.teamNames()));
            infoArray.push(stringifyField(aCase.caseName));
            infoArray.push(stringifyField(aCase.caseNo));
            infoArray.push(stringifyField(text));
            infoArray.push(stringifyField(score));
            infoArray.push(stringifyField(aCase.lastScore.updated_at));
            infoArray.push(stringifyField(count));
            infoArray.push(stringifyField(informationNeed));
            infoArray.push(stringifyField(notes));
            infoArray.push(stringifyField(options));

            dataString = infoArray.join(',');
            csvContent += dataString + EOL;
          });

          return csvContent;
        }

        /**
         * Creates CSV string of queries from a case object
         *
         * @param aCase
         *
         */
        function stringifyQueries (aCase, withHeader) {
          var csvContent  = '';

          if (withHeader) {
            csvContent += self.queriesHeaderToCSV();
          }

          if (aCase.lastScore === undefined || aCase.lastScore === null) {
            return csvContent;
          }

          return queriesSvc.bootstrapQueries(aCase.caseNo)
            .then(function() {
              angular.forEach(queriesSvc.queries, function (query) {

                var ratings  = query.ratingsStore.bestDocs(50);

                angular.forEach(ratings, function (rating) {
                  var dataString;

                  var infoArray = [];
                  infoArray.push(stringifyField(query.queryText));
                  infoArray.push(stringifyField(rating.id));
                  infoArray.push(stringifyField(rating.rating));

                  dataString = infoArray.join(',');
                  csvContent += dataString + EOL;
                });
              });

              return csvContent;
            });
        }

        /**
         * Somewhat similar to stringifyQueries, but the logic is all
         * on the server side.
         *
         * @param aCase
         *
         */
        function exportBasicFormat(aCase) {
          $http.get('api/export/ratings/' + aCase.caseNo + '.csv?file_format=basic')
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/csv'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_basic.csv'));
            });
        }
        function exportBasicFormatSnapshot(aCase, snapshotId) {
          $http.get('api/export/ratings/' + aCase.caseNo + '.csv?file_format=basic_snapshot&snapshot_id=' + snapshotId)
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/csv'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_basic_snapshot.csv'));
            });
        }

        function exportTrecFormat(aCase) {
          $http.get('api/export/ratings/' + aCase.caseNo + '.txt?file_format=trec')
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/plain'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_trec.txt'));
            });
        }
        function exportTrecFormatSnapshot(aCase, snapshotId) {
          $http.get('api/export/ratings/' + aCase.caseNo + '.txt?file_format=trec_snapshot&snapshot_id=' + snapshotId)
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/plain'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_trec_snapshot.txt'));
            });
        }
        
        function exportQuepidFormat(aCase) {
          $http.get('api/export/cases/' + aCase.caseNo)
            .then(function(response) {
              var blob = new Blob([$filter('json')(response.data)], {
                type: 'application/json'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_case.json'));
            });
        }

        function exportRREFormat(aCase) {
          $http.get('api/export/ratings/' + aCase.caseNo + '.json?file_format=rre')
            .then(function(response) {
              var blob = new Blob([$filter('json')(response.data)], {
                type: 'application/json'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_rre.json'));
            });
        }

        function exportLTRFormat(aCase) {
          $http.get('api/export/ratings/' + aCase.caseNo + '.txt?file_format=ltr')
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/plain'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_ltr.txt'));
            });
        }

        function exportInformationNeed(aCase) {
          $http.get('api/export/queries/information_needs/' + aCase.caseNo + '.csv')
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/csv'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_information_need.csv'));
            });
        }

        /**
         * Creates CSV string of queries from a case object
         * including every field in the field list
         *
         * @param aCase
         *
         */
        function stringifyQueriesDetailed (aCase, queries, withHeader) {
          var csvContent  = '';

          if (aCase.lastScore === undefined || aCase.lastScore === null) {
            return csvContent;
          }

          var firstQuery = queries[Object.keys(queries)[0]];
          var fields     = firstQuery.fieldSpec().fields;
          // subtract the mandatory fields from our list of fields to be written out
          fields.splice(fields.indexOf(firstQuery.fieldSpec().id),1);
          fields.splice(fields.indexOf(firstQuery.fieldSpec().title),1);

          if (withHeader) {
            csvContent += self.detailedQueriesHeaderToCSV(fields);
          }

          angular.forEach(queries, function (query) {
            var docs = query.docs;
            if (docs.length === 0 ) {
              var dataString;
              var infoArray = [];
              infoArray.push(stringifyField(aCase.teamNames()));
              infoArray.push(stringifyField(aCase.caseName));
              infoArray.push(stringifyField(aCase.lastScore.case_id));
              infoArray.push(stringifyField(query.queryText));
                          
              dataString = infoArray.join(',');
              csvContent += dataString + EOL;
            }
            else {
              angular.forEach(docs, function (doc, index) {
                var dataString;
                var infoArray = [];

                infoArray.push(stringifyField(aCase.teamNames()));
                infoArray.push(stringifyField(aCase.caseName));
                infoArray.push(stringifyField(aCase.lastScore.case_id));
                infoArray.push(stringifyField(query.queryText));
                infoArray.push(stringifyField(doc.id));
                infoArray.push(stringifyField(index+1));
                infoArray.push(stringifyField(doc.title));
                infoArray.push(stringifyField(doc.getRating()));

                angular.forEach(fields, function (field) {
                  infoArray.push(stringifyField(doc.doc[field]));
                });
                dataString = infoArray.join(',');
                csvContent += dataString + EOL;
              });
            }
          });

          return csvContent;
        }

        const escapeJsonStringForCSV = function (input) {
          if (typeof input === 'string') {
            return `"${input.replace(/\"/g, '""')}"`;
          }
          return input;
        };

        const stringifyField = function (data) {
          if (typeof data === 'object'){
            if (data === null){
              data = '';
            }
            else {
              data = escapeJsonStringForCSV(JSON.stringify(data));
            }
          }
          else if (typeof data === 'string') {
            data = data.trim().replace(/"/g, '""'); // Escape double quotes

            if (data.indexOf(',') > -1 || data.indexOf('\n') > -1 || data.indexOf('\r') > -1) {
              data = textDelimiter + data + textDelimiter;
            }

            if (data.startsWith('=') || data.startsWith('@') || data.startsWith('+') || data.startsWith('-')) {
              data = ` ${data}`;
            }
          }
          return data;
        };

        /**
         * Creates CSV string of snapshot
         *
         * @param snapshot
         *
         */

        function stringifySnapshot (aCase, snapshot, withHeader) {
          const snapshotName = snapshot.name();
          const snapshotTime = snapshot.time;
          const caseNumber = aCase.caseNo;
          let csvContent = '';
          
          var fields = [];
          angular.forEach(snapshot.docs, function (docs) {
            angular.forEach(docs, function (doc) {
              fields = mergeArrays(fields, Object.keys(doc.fields));
            });
          });

          if (withHeader) {
            csvContent += self.snapshotHeaderToCSV(fields);
          }
          angular.forEach(snapshot.docs, function (docs, queryId) {
            const queryIdToMatch = parseInt(queryId, 10);
            const matchingQuery = snapshot.queries.filter(function(query) {
              return query.queryId === queryIdToMatch;
            });
            if (matchingQuery[0]) {
              const matchingQueryText = matchingQuery[0].queryText;
              if (matchingQueryText) {
                angular.forEach(docs, function (doc, idx) {
                  let infoArray = [];
                  infoArray.push(stringifyField(snapshotName));
                  infoArray.push(stringifyField(snapshotTime));
                  infoArray.push(stringifyField(caseNumber));
                  infoArray.push(stringifyField(matchingQueryText));
                  infoArray.push(stringifyField(doc.id));
                  infoArray.push(stringifyField(idx + 1));
                  
                  angular.forEach(fields, function (field) {
                    infoArray.push(stringifyField(doc.fields[field]));
                  });
                  
                  csvContent += infoArray.join(',') + EOL;
                });
              }
            }
          });

          return csvContent;
        }

        /**
         * Take a string and make it ready for being a downloaded file name
         *
         * @param aCase
         *
         */
        function formatDownloadFileName (fileName) {
          var downloadFileName = fileName.replace(/ /g,'_').replace(/:/g,'_');

          return downloadFileName;
        }

        function mergeArrays(...arrays) {
          var mergedArray = [];
        
          arrays.forEach(function(array) {
            array.forEach(function(value) {
              if (!mergedArray.includes(value)) {
                mergedArray.push(value);
              }
            });
          });
        
          return mergedArray;
        }
        
        function arrayContains(containingArray, subsetArray){
           subsetArray.forEach(function(value) {
             if (!containingArray.includes(value)) {
               return false;
             }
           });
           return true;
        }
        
        function fixObjectKeys (docs){
          var newDocs = [];
          angular.forEach(docs, function (doc) {
            var newDoc = {};
            Object.keys(doc).forEach(key => {              
              const trimmedKey = key.trim();
              newDoc[trimmedKey] = doc[key];
            });
            newDocs.push(newDoc);
          });
          return newDocs;
        }          
      }
    ]);
})();
