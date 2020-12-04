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
        self.exportRREFormat            = exportRREFormat;
        self.exportLTRFormat            = exportLTRFormat;
        self.stringifyQueriesDetailed   = stringifyQueriesDetailed;
        self.stringifySnapshot          = stringifySnapshot;
        self.formatDownloadFileName     = formatDownloadFileName;

        function caseHeaderToCSV () {
          var header = [
            'Team Name',
            'Case Name',
            'Case ID',
            'Query Text',
            'Score',
            'Date Last Scored',
            'Count',
            'Notes'
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
            'Title',
            'Rating',
          ];

          angular.forEach(fieldList, function(fieldName) {
            header.push(fieldName);
          });

          var headerString = header.join(',');

          return '' + headerString + EOL;
        }

        function snapshotHeaderToCSV () {
          var header = [
            'Snapshot Name',
            'Snapshot Time',
            'Case ID',
            'Query Text',
            'Doc ID',
            'Doc Position',
          ];

          var headerString = header.join(',');

          return '' + headerString + EOL;
        }

        /**
         * Creates CSV string of case from a case object
         *
         * @param aCase
         *
         */
        function stringify (aCase, withHeader) {
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

            var query = aCase.queries.filter(function(q) { return q.queryId === id; })[0];
            var notes = query ? query.notes || null : null;

            infoArray = [];

            infoArray.push(stringifyField(aCase.teamNames()));
            infoArray.push(stringifyField(aCase.caseName));
            infoArray.push(stringifyField(aCase.lastScore.case_id));
            infoArray.push(stringifyField(text));
            infoArray.push(stringifyField(score));
            infoArray.push(stringifyField(aCase.lastScore.updated_at));
            infoArray.push(stringifyField(count));
            infoArray.push(stringifyField(notes));

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
          $http.get('/api/export/ratings/' + aCase.caseNo + '.csv?file_format=basic')
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/csv'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_basic.csv'));
            });
        }
        function exportBasicFormatSnapshot(aCase, snapshotId) {
          $http.get('/api/export/ratings/' + aCase.caseNo + '.csv?file_format=basic_snapshot&snapshot_id=' + snapshotId)
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/csv'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_basic_snapshot.csv'));
            });
        }

        function exportRREFormat(aCase) {
          $http.get('/api/export/ratings/' + aCase.caseNo + '.json?file_format=rre')
            .then(function(response) {
              var blob = new Blob([$filter('json')(response.data)], {
                type: 'application/json'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_rre.json'));
            });
        }

        function exportLTRFormat(aCase) {
          $http.get('/api/export/ratings/' + aCase.caseNo + '.txt?file_format=ltr')
            .then(function(response) {
              var blob = new Blob([response.data], {
                type: 'text/plain'
              });

              /*global saveAs */
              saveAs(blob, formatDownloadFileName(aCase.caseName + '_ltr.txt'));
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
          var fields     = firstQuery.fieldSpec().subs;

          if (withHeader) {
            csvContent += self.detailedQueriesHeaderToCSV(fields);
          }

          angular.forEach(queries, function (query) {
            var docs = query.docs;

            angular.forEach(docs, function (doc) {
              var dataString;
              var infoArray = [];

              infoArray.push(stringifyField(aCase.teamNames()));
              infoArray.push(stringifyField(aCase.caseName));
              infoArray.push(stringifyField(aCase.lastScore.case_id));
              infoArray.push(stringifyField(query.queryText));
              infoArray.push(stringifyField(doc.id));
              infoArray.push(stringifyField(doc.title));
              infoArray.push(stringifyField(doc.getRating()));

              angular.forEach(fields, function(field) {
                infoArray.push(stringifyField(doc.subs[field]));
              });

              dataString = infoArray.join(',');
              csvContent += dataString + EOL;
            });
          });

          return csvContent;
        }

        /**
         * Creates CSV string of snapshot
         *
         * @param snapshot
         *
         */

        function stringifySnapshot (aCase, snapshot, withHeader) {
          var csvContent  = '';


          if (withHeader) {
            csvContent += self.snapshotHeaderToCSV();
          }

          angular.forEach(snapshot.docs, function (docs,queryId) {
            angular.forEach(docs, function (doc,idx) {
              var dataString;
              var infoArray = [];

              infoArray.push(stringifyField(snapshot.name()));
              infoArray.push(stringifyField(snapshot.time));
              infoArray.push(stringifyField(aCase.caseNo));

              queryId = parseInt(queryId,10);
              var query = snapshot.queries.filter(function(q) { return q.queryId === queryId; })[0];

              infoArray.push(stringifyField(query.query_text));
              infoArray.push(stringifyField(doc.id));
              infoArray.push(stringifyField(idx+1));

              dataString = infoArray.join(',');
              csvContent += dataString + EOL;
            });
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


        var stringifyField = function (data) {
          if (typeof data === 'object'){
            if (data === null){
              data = '';
            }
            else {
              data = data.join(',');
            }
          }
          if (typeof data === 'string') {
            data = data.replace(/"/g, '""'); // Escape double quotes

            if (data.indexOf(',') > -1 || data.indexOf('\n') > -1 || data.indexOf('\r') > -1) {
              data = textDelimiter + data + textDelimiter;
            }

            if (data.startsWith('=') || data.startsWith('@') || data.startsWith('+') || data.startsWith('-')) {
              data = ' ' + data;
            }

            return data;
          }

          return data;
        };
      }
    ]);
})();
