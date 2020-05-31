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
      ctrl.csv          = {
        clearQueries:     false,
        content:          null,
        header:           true,
        separator:        ',',
        separatorVisible: false,
        result:           null
      };

      ctrl.rre         = {
        content:           null
      }

      ctrl.options = {
        which: 'undefined'
      };

      // Watches
      $scope.$watch('ctrl.csv.content', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'csv';
        }
      },true);

      $scope.$watch('ctrl.rre.content', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'rre';
        }
      },true);

      $scope.$watch('ctrl.rre', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'rre';
        }
      },true);

      $scope.pickedFile = function() {
        var f = document.getElementById('file').files[0],
            r = new FileReader();
        ctrl.options.which = 'rre';
        ctrl.loading = true;
        r.onloadend = function(e) {
          var data = e.target.result;
          console.log("Loaded data");
          ctrl.rre.content = data;
          ctrl.loading = false;

          //send your binary data via $http or $resource or do anything else with it
        }

        r.readAsText(f);
      }

      $scope.add = function() {
        var f = document.getElementById('file').files[0],
            r = new FileReader();

        ctrl.options.which = 'rre';
        r.onloadend = function(e) {
          var data = e.target.result;
          console.log("Loaded data");
          ctrl.rre.content = data;
          //send your binary data via $http or $resource or do anything else with it
        }

        r.readAsText(f);
      }

      function readText() {
        var f = document.getElementById('file').files[0],
            r = new FileReader();

        r.onloadend = function(e) {
          var data = e.target.result;
          console.log("Loaded data");
          ctrl.rre.content = data;
          //send your binary data via $http or $resource or do anything else with it
        }

        r.readAsText(f);
      }

      ctrl.ok = function () {
        if ( ctrl.options.which === 'csv' ) {
          ctrl.import.alert = undefined;
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
        }

        // check if any alerts defined.
        if (ctrl.import.alert === undefined) {
          ctrl.loading = true;
          if ( ctrl.options.which === 'csv' ) {

            importRatingsSvc.importCSVFormat(
              ctrl.theCase,
              ctrl.csv.result,
              ctrl.csv.clearQueries
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
              ctrl.rre.content
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
        }
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
