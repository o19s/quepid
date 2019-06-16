'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ExportCasesCtrl', [
    '$scope',
    'caseSvc',
    'caseCSVSvc',
    function (
      $scope,
      caseSvc,
      caseCSVSvc
    ) {
      var ctrl = this;
      ctrl.caseList = $scope.caseList;

      // Functions
      ctrl.exportOwnedToCSV  = exportOwnedToCSV;
      ctrl.exportSharedToCSV = exportSharedToCSV;
      ctrl.exportAllToCSV    = exportAllToCSV;

      var exportCasesToCSV = function(cases, fileName) {
        var csv = '';
        csv += caseCSVSvc.caseHeaderToCSV();

        angular.forEach(cases, function(aCase) {
          csv += caseCSVSvc.stringify(aCase);
        });

        var blob = new Blob([csv], {
          type: 'text/csv'
        });

        /*global saveAs */
        saveAs(blob, fileName);
      };

      function exportOwnedToCSV() {
        var ownedCases = caseSvc.filterCases(ctrl.caseList, true);
        exportCasesToCSV(ownedCases, 'owned-cases.csv');
      }

      function exportSharedToCSV() {
        var sharedCases = caseSvc.filterCases(ctrl.caseList, false);
        exportCasesToCSV(sharedCases, 'shared-cases.csv');
      }

      function exportAllToCSV() {
        exportCasesToCSV(ctrl.caseList, 'all-cases.csv');
      }
    }
  ]);
