'use strict';

angular.module('QuepidApp')
  .controller('ImportRatingsModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'importRatingsSvc',
    'theCase',
    function ($scope, $uibModalInstance, importRatingsSvc, theCase) {
      var ctrl = this;

      ctrl.theCase      = theCase;
      ctrl.loading      = false;
      ctrl.import       = {};
      ctrl.clearQueries = false;
      ctrl.csv          = {
        content:          null,
        header:           true,
        separator:        ',',
        separatorVisible: false,
        result:           null
      };

      ctrl.rre         = {
        content:           null
      };

      ctrl.ltr         = {
        content:           null
      };

      ctrl.options = {
        which: 'undefined'
      };

      // Watches
      $scope.$watch('ctrl.csv.content', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'csv';
          ctrl.import.alert = undefined;
          ctrl.checkCSVHeaders();
          ctrl.checkCSVBody();
        }
      },true);


      $scope.pickedRREFile = function() {
        var f = document.getElementById('rreFile').files[0],
            r = new FileReader();

        // This next two lines don't seem to trigger the watches that I wanted.
        ctrl.options.which = 'rre';
        ctrl.loading = true;
        r.onloadend = function(e) {
          var data = e.target.result;
          ctrl.rre.content = data;
          ctrl.loading = false;
        };

        r.readAsText(f);
      };

      $scope.pickedLTRFile = function() {
        var f = document.getElementById('ltrFile').files[0],
            r = new FileReader();

        // This next two lines don't seem to trigger the watches that I wanted.
        ctrl.options.which = 'ltr';
        ctrl.loading = true;
        r.onloadend = function(e) {
          var data = e.target.result;
          ctrl.ltr.content = data;
          ctrl.loading = false;
        };

        r.readAsText(f);
      };

      ctrl.ok = function () {
        if ( ctrl.options.which === 'csv' ) {
          ctrl.checkCSVHeaders();
          ctrl.checkCSVBody();
        }

        // check if any alerts defined.
        if (ctrl.import.alert === undefined) {
          ctrl.loading = true;
          if ( ctrl.options.which === 'csv' ) {

            importRatingsSvc.importCSVFormat(
              ctrl.theCase,
              ctrl.csv.result,
              ctrl.clearQueries
            ).then(function() {
                ctrl.loading = false;
                $uibModalInstance.close();
              },
              function(response) {
                var error = 'Unable to import ratings from CSV: ';
                error += response.status;
                error += ' - ' + response.statusText;
                ctrl.loading = false;
                $uibModalInstance.close(error);
              });
          }
          else if (ctrl.options.which === 'rre' ) {
            importRatingsSvc.importRREFormat(
              ctrl.theCase,
              ctrl.rre.content,
              ctrl.clearQueries
            ).then(function() {
                ctrl.loading = false;
                $uibModalInstance.close();
              },
              function(response) {
                var error = 'Unable to import ratings from RRE: ';
                error += response.status;
                error += ' - ' + response.statusText;
                ctrl.loading = false;
                $uibModalInstance.close(error);
              });
          }
          else if (ctrl.options.which === 'ltr' ) {
            importRatingsSvc.importLTRFormat(
              ctrl.theCase,
              ctrl.ltr.content,
              ctrl.clearQueries
            ).then(function() {
                ctrl.loading = false;
                $uibModalInstance.close();
              },
              function(response) {
                var error = 'Unable to import ratings from LTR: ';
                error += response.status;
                error += ' - ' + response.statusText;
                ctrl.loading = false;
                $uibModalInstance.close(error);
              });
          }
        }
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.checkCSVHeaders = function() {
        var headers = ctrl.csv.content.split('\n')[0];
        headers     = headers.split(ctrl.csv.separator);

        var expectedHeaders = [
          'query', 'docid', 'rating'
        ];

        if (!angular.equals(headers, expectedHeaders)) {
          var alert = 'Headers mismatch! Please make sure you have the correct headers in you file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
          alert += '</strong>';

          ctrl.import.alert = alert;
        }
      };
      ctrl.checkCSVBody = function() {
        var lines = ctrl.csv.content.split('\n');
        var i = 1;
        var alert;
        for (i = 1; i < lines.length; i++) {
          var line = lines[i];
          if (line && line.split(ctrl.csv.separator).length > 3){
            if (alert === undefined){
              alert = 'Must have three (or fewer) columns for every line in CSV file: ';
              alert += '<br /><strong>';
            }
            alert += 'line ' + (i + 1) + ': ';
            alert += line;
            alert += '<br />';
          }
        }
        if (alert !== undefined){
          alert += '</strong>';
          ctrl.import.alert = alert;
        }
      };
    }
  ]);
