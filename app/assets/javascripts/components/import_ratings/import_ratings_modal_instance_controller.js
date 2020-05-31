'use strict';

angular.module('QuepidApp')
  .controller('ImportRatingsModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'importRatingsSvc',
    'theCase',
    function ($scope, $uibModalInstance, importRatingsSvc, theCase) {
      var ctrl = this;

      ctrl.selectedCase = theCase;
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

      ctrl.options = {
        which: 'undefined'
      };

      // Watches
      $scope.$watch('ctrl.csv.content', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'csv';
        }
      },true);

      ctrl.ok = function () {
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

        } else {
          ctrl.loading = true;
          importRatingsSvc.importCSVFormat(
            ctrl.theCase,
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
