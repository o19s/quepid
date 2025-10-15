'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportSnapshotModalInstanceCtrl', [
    '$uibModalInstance',
    'flash',
    'querySnapshotSvc',
    'caseSvc',
    'queriesSvc',
    function (
      $uibModalInstance,
      flash,
      querySnapshotSvc,
      caseSvc,
      queriesSvc
    ) {
      var ctrl = this;

      ctrl.import = { loading: false };
      ctrl.csv    = {
        content:          null,
        header:           true,
        separator:        ',',
        separatorVisible: false,
        result:           null
      };

      // Check that header is there
      // Check that header contains the elements expected
      ctrl.ok = function () {
        var headers = ctrl.csv.content.split('\n')[0];
        headers     = headers.split(ctrl.csv.separator);

        var expectedHeaders = [
          'Snapshot Name', 'Snapshot Time', 'Case ID', 'Query Text', 'Doc ID', 'Doc Position'
        ];

        // Check if all expected headers are included in the uploaded CSV
        var allHeadersIncluded = expectedHeaders.every(function(header) {
          return headers.indexOf(header) !== -1;
        });
        
        if (!allHeadersIncluded) {
          // Get missing headers for the error message
          var missingHeaders = expectedHeaders.filter(function(header) {
            return headers.indexOf(header) === -1;
          });
          var alert = 'Missing required headers! Please make sure your file includes all required headers (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += missingHeaders.join(', ');
          alert += '</strong>';

          ctrl.import.alert = {
            'text': alert,
            'type': 'text-danger'
          };
        } else {
          ctrl.import.loading = true;

          importCSV(ctrl.csv)
            .then(function() {
              var result = {
                success: true,
                message: 'Snapshots imported successfully!',
              };

              ctrl.import.loading = false;
              $uibModalInstance.close(result);
            }, function() {
               var result = {
                error:    true,
                message:  'Could not import snapshots successfully! Please try again.',
              };

              ctrl.import.loading = false;
              $uibModalInstance.close(result);
            });
        }
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      function importCSV (csv) {
        return querySnapshotSvc.importSnapshots(csv.result)
          .then(function() {
            queriesSvc.reset();

            if (caseSvc.isCaseSelected()) {
              var theCase = caseSvc.getSelectedCase();
              queriesSvc.bootstrapQueries(theCase.caseNo)
                .then(function() {
                  angular.forEach(queriesSvc.queries, function(q) {
                    q.search()
                      .then(function success() {
                      }, function error(errorMsg) {
                        flash.error = 'Your new query had an error';
                        flash.to('search-error').error = errorMsg;
                      });
                  });
                });
            }
          });
      }
    }
  ]);
