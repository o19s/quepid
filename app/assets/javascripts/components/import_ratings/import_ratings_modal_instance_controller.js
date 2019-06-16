'use strict';

angular.module('QuepidApp')
  .controller('ImportRatingsModalInstanceCtrl', [
    '$uibModalInstance',
    'importRatingsSvc',
    'selectedCase',
    function ($uibModalInstance, importRatingsSvc, selectedCase) {
      var ctrl = this;

      ctrl.selectedCase = selectedCase;
      ctrl.loading      = false;
      ctrl.import       = {};
      ctrl.csv          = {
        clearQueries:     false,
        content:          null,
        header:           true,
        separator:        ',',
        separatorVisible: false,
        result:           null
      };

      ctrl.ok = function () {
        var headers = ctrl.csv.content.split('\n')[0];
        headers     = headers.split(ctrl.csv.separator);

        var expectedHeaders = [
          'Query Text', 'Doc ID', 'Rating'
        ];

        if (!angular.equals(headers, expectedHeaders)) {
          var alert = 'Headers mismatch! Please make sure you have the correct headers in you file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
          alert += '</strong>';

          ctrl.import.alert = {
            'text': alert,
            'type': 'text-danger'
          };
        } else {
          ctrl.loading = true;
          importRatingsSvc.makeCall(
            ctrl.selectedCase,
            ctrl.csv.result,
            ctrl.csv.clearQueries
          ).then(function() {
              ctrl.loading = false;
              $uibModalInstance.close();
            },
            function(response) {
              var error = 'Unable to import ratings: ';
              error += response.status;
              error += ' - ' + response.statusText;
              ctrl.loading = false;
              $uibModalInstance.close(error);
            });
        }
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
