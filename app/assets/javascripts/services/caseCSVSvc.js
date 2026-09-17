'use strict';

/**
 *
 * Service to turn scoring data for a case into CSV format.
 *
 * Inspired by https://github.com/asafdav/ng-csv/blob/master/src/ng-csv/services/csv-service.js
 *
 * Only the "detailed" export format lives here now — every other format the
 * AngularJS <export-case> component used to build was ported to
 * app/javascript/utils/case_csv.js (Stimulus `export-case-core`), since it's
 * reconstructable from persisted API data alone. "detailed" needs the live,
 * already-searched documents held in queriesSvc (not reconstructable from the
 * server without re-running the search), so it stays here and is triggered
 * via a `document` CustomEvent from the Stimulus modal — see the bridge
 * listener at the bottom of this file.
 *
 * `arrayContains` and `fixObjectKeys` also stay here — they're still used by
 * import-ratings and the new-case wizard's CSV import, unrelated to export.
 */

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .service('caseCSVSvc', [
      'caseSvc',
      'queriesSvc',
      function(caseSvc, queriesSvc) {
        var self          = this;
        var EOL           = '\r\n';
        var textDelimiter = '"';

        self.detailedQueriesHeaderToCSV = detailedQueriesHeaderToCSV;
        self.stringifyQueriesDetailed   = stringifyQueriesDetailed;
        self.formatDownloadFileName     = formatDownloadFileName;
        self.arrayContains              = arrayContains;
        self.fixObjectKeys              = fixObjectKeys;

        // Bridge from the Stimulus export-case-core modal (core case toolbar):
        // "detailed" needs the live, already-searched documents held in
        // queriesSvc, so the modal dispatches this event instead of exporting
        // it itself. See app/javascript/controllers/export_case_core_controller.js.
        document.addEventListener('export-case:detailed', function(event) {
          var theCase = caseSvc.getSelectedCase();
          if (!theCase || String(theCase.caseNo) !== String(event.detail.caseId)) {
            return; // the case changed (or isn't loaded yet) since the modal was opened
          }

          var csv  = self.stringifyQueriesDetailed(theCase, queriesSvc.queries, true);
          var blob = new Blob([csv], {
            type: 'text/csv'
          });

          /*global saveAs */
          saveAs(blob, self.formatDownloadFileName(theCase.caseName + '_detailed.csv'));
        });

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
         * Take a string and make it ready for being a downloaded file name
         *
         * @param aCase
         *
         */
        function formatDownloadFileName (fileName) {
          var downloadFileName = fileName.replace(/ /g,'_').replace(/:/g,'_');

          return downloadFileName;
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
    ])
    // Nothing on the core case page injects caseCSVSvc anymore now that the
    // export-case modal is Stimulus (import-ratings/the wizard only pull in
    // arrayContains/fixObjectKeys when THEIR modals open). AngularJS services
    // are lazy, so without this the "detailed" bridge listener above would
    // never attach. Force eager instantiation at app bootstrap instead.
    .run(['caseCSVSvc', function(caseCSVSvc) {
      return caseCSVSvc;
    }]);
})();
