'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ExportCaseCtrl', [
    '$scope',
    'caseCSVSvc',
    function (
      $scope,
      caseCSVSvc
    ) {
      var ctrl = this;
      ctrl.theCase = $scope.theCase;

      // Functions
      ctrl.exportCSV        = exportCSV;
      ctrl.exportRatingsCSV = exportRatingsCSV;

      function exportCSV() {
        var csv = caseCSVSvc.stringify(ctrl.theCase, true);

        var blob = new Blob([csv], {
          type: 'text/csv'
        });

        /*global saveAs */
        saveAs(blob, ctrl.theCase.caseName + '.csv');
      }

      function exportRatingsCSV() {
        caseCSVSvc.exportRatings(ctrl.theCase);        
      }
    }
  ]);
