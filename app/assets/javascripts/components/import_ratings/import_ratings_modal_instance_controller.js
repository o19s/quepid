'use strict';

angular.module('QuepidApp')
  .controller('ImportRatingsModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'importRatingsSvc',
    'theCase',
    'querySnapshotSvc',
    'caseCSVSvc',
    function ($scope, $uibModalInstance, importRatingsSvc, theCase, querySnapshotSvc, caseCSVSvc) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.loading = false;
      ctrl.clearQueries = false;
      ctrl.createQueries = false;
      ctrl.csv = {
        content: null,
        header: true,
        separator: ',',
        separatorVisible: false,
        result: null,
        import: {}
      };
      ctrl.information_needs = {
        content: null,
        header: true,
        separator: ',',
        separatorVisible: false,
        result: null,
        import: {}
      };
      ctrl.snapshots = {
        content: null,
        header: true,
        separator: ',',
        separatorVisible: false,
        result: null,
        import: {}
      };

      ctrl.rre = {
        content: null
      };

      ctrl.ltr = {
        content: null
      };

      ctrl.options = {
        which: undefined
      };

      // Watches
      $scope.$watch('ctrl.csv.content', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'csv';
          ctrl.csv.import.alert = undefined;
          ctrl.checkCSVHeaders();
          ctrl.checkCSVBody();
        }
      }, true);

      $scope.$watch('ctrl.information_needs.content', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'information_needs';
          ctrl.information_needs.import.alert = undefined;
          ctrl.checkInformationNeedsHeaders();
          ctrl.checkInformationNeedsBody();
        }
      }, true);

      $scope.$watch('ctrl.snapshots.content', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.options.which = 'snapshots';
          ctrl.snapshots.import.alert = undefined;
          ctrl.checkSnapshotHeaders();
          //ctrl.checkSnapshotBody();
        }
      }, true);

      $scope.pickedRREFile = function () {
        var f = document.getElementById('rreFile').files[0],
          r = new FileReader();

        // This next two lines don't seem to trigger the watches that I wanted.
        ctrl.options.which = 'rre';
        ctrl.loading = true;
        r.onloadend = function (e) {
          var data = e.target.result;
          ctrl.rre.content = data;
          ctrl.loading = false;
        };

        r.readAsText(f);
      };

      $scope.pickedLTRFile = function () {
        var f = document.getElementById('ltrFile').files[0],
          r = new FileReader();

        // This next two lines don't seem to trigger the watches that I wanted.
        ctrl.options.which = 'ltr';
        ctrl.loading = true;
        r.onloadend = function (e) {
          var data = e.target.result;
          ctrl.ltr.content = data;
          ctrl.loading = false;
        };

        r.readAsText(f);
      };

      ctrl.showWarning = function () {
        return (ctrl.options.which !== undefined);
      };

      ctrl.clearSelection = function () {
        ctrl.options.which = undefined;
        ctrl.clearQueries = false;
      };

      ctrl.ratingsTypePicked = function () {
        return (ctrl.options.which === 'csv' || ctrl.options.which === 'rre' || ctrl.options.which === 'ltr');
      };

      ctrl.informationNeedsTypePicked = function () {
        return (ctrl.options.which === 'information_needs');
      };
      
      ctrl.snapshotTypePicked = function () {
        return (ctrl.options.which === 'snapshots');
      };

      ctrl.ok = function () {
        if (ctrl.options.which === 'snapshots') {
          //ctrl.checkCSVHeaders();
        
          ctrl.snapshots.import.loading = true;
          querySnapshotSvc.importSnapshotsToSpecificCase(ctrl.snapshots.result, theCase.caseNo)
            .then(function () {
              var result = {
                success: true,
                message: 'Snapshots imported successfully!',
              };
              ctrl.snapshots.import.loading = false;
              $uibModalInstance.close(result);
            }, function () {
              var result = {
                error: true,
                message: 'Could not import snapshots successfully! Please try again.',
              };

              ctrl.snapshots.import.loading = false;
              $uibModalInstance.close(result);
            });
          
        } else if (ctrl.options.which === 'csv') {
          ctrl.checkCSVHeaders();
          ctrl.checkCSVBody();
        }

        // check if any alerts defined.
        if (ctrl.csv.import.alert === undefined && ctrl.information_needs.import.alert === undefined) {
          ctrl.loading = true;
          if (ctrl.options.which === 'information_needs') {
            importRatingsSvc.importInformationNeeds(
              ctrl.theCase,
              ctrl.information_needs.content,
              ctrl.createQueries
            ).then(function () {
                ctrl.loading = false;
                let modalResponse = {
                  success: true,
                  message: 'Successfully imported information needs from CSV.'
                };
                $uibModalInstance.close(modalResponse);
              },
              function (response) {
                let errorMessage = 'Unable to import information needs from CSV. ';
                if (response.data && response.data.message) {
                  errorMessage += response.data.message;
                } else {
                  errorMessage += response.status;
                  errorMessage += ' - ' + response.statusText;
                }

                let modalResponse = {
                  error: true,
                  message: errorMessage.toString()
                };

                ctrl.loading = false;
                $uibModalInstance.close(modalResponse);
              });
          } else if (ctrl.options.which === 'csv') {

            importRatingsSvc.importCSVFormat(
              ctrl.theCase,
              ctrl.csv.result,
              ctrl.clearQueries
            ).then(function () {
                ctrl.loading = false;
                let modalResponse = {
                  success: true,
                  message: 'Successfully imported ratings from CSV.'
                };
                $uibModalInstance.close(modalResponse);
              },
              function (response) {
                let errorMessage = 'Unable to import ratings from CSV: ';
                errorMessage += response.status;
                errorMessage += ' - ' + response.statusText;

                let modalResponse = {
                  error: true,
                  message: errorMessage.toString()
                };

                ctrl.loading = false;
                $uibModalInstance.close(modalResponse);
              });
          } else if (ctrl.options.which === 'rre') {
            importRatingsSvc.importRREFormat(
              ctrl.theCase,
              ctrl.rre.content,
              ctrl.clearQueries
            ).then(function () {
                ctrl.loading = false;
                let modalResponse = {
                  success: true,
                  message: 'Successfully imported ratings from RRE.'
                };
                $uibModalInstance.close(modalResponse);
              },
              function (response) {
                let errorMessage = 'Unable to import ratings from RRE: ';
                errorMessage += response.status;
                errorMessage += ' - ' + response.statusText;

                let modalResponse = {
                  error: true,
                  message: errorMessage.toString()
                };

                ctrl.loading = false;
                $uibModalInstance.close(modalResponse);
              });
          } else if (ctrl.options.which === 'ltr') {
            importRatingsSvc.importLTRFormat(
              ctrl.theCase,
              ctrl.ltr.content,
              ctrl.clearQueries
            ).then(function () {
                ctrl.loading = false;
                let modalResponse = {
                  success: true,
                  message: 'Successfully imported ratings from LTR.'
                };
                $uibModalInstance.close(modalResponse);
              },
              function (response) {
                let errorMessage = 'Unable to import ratings from LTR: ';
                errorMessage += response.status;
                errorMessage += ' - ' + response.statusText;

                let modalResponse = {
                  error: true,
                  message: errorMessage.toString()
                };

                ctrl.loading = false;
                $uibModalInstance.close(modalResponse);
              });
          }
        }
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.checkCSVHeaders = function () {
        var headers = ctrl.csv.content.split('\n')[0];
        headers = headers.split(ctrl.csv.separator);

        var expectedHeaders = [
          'query', 'docid', 'rating'
        ];

        if (!angular.equals(headers, expectedHeaders)) {
          var alert = 'Headers mismatch! Please make sure you have the correct headers in your file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
          alert += '</strong>';

          ctrl.csv.import.alert = alert;
        }
      };
      ctrl.checkCSVBody = function () {
        var lines = ctrl.csv.content.split('\n');
        var i = 1;
        var alert;
        for (i = 1; i < lines.length; i++) {
          var line = lines[i];
          if (line && line.split(ctrl.csv.separator).length > 3) {
            var matches = line.match(/"/g);
            if (matches !== undefined && matches !== null && matches.length === 2) {
              // two double quotes means we are okay
            } else {
              // check for wrapping in double quotes.
              if (alert === undefined) {
                alert = 'Must have three (or fewer) columns for every line in CSV file.  Make sure to wrap any queries with <code>,</code> in double quotes.';
                alert += '<br /><strong>';
              }
              alert += 'line ' + (i + 1) + ': ';
              alert += line;
              alert += '<br />';
            }
          }
        }
        if (alert !== undefined) {
          alert += '</strong>';
          ctrl.csv.import.alert = alert;
        }
      };

      ctrl.checkSnapshotHeaders = function () {
        var headers = ctrl.snapshots.content.split('\n')[0];
        headers = headers.split(ctrl.snapshots.separator);

        var expectedHeaders = [
          'Snapshot Name', 'Snapshot Time', 'Case ID', 'Query Text', 'Doc ID', 'Doc Position'
        ];

        if (!caseCSVSvc.arrayContains(headers, expectedHeaders)) {
          var alert = 'Required headers mismatch! Please make sure you have the correct headers in your file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
          alert += '</strong>';

          ctrl.snapshots.import.alert = alert;
        }
      };
      
      ctrl.checkInformationNeedsHeaders = function () {
        var headers = ctrl.information_needs.content.split('\n')[0];
        headers = headers.split(ctrl.information_needs.separator);

        var expectedHeaders = [
          'query', 'information_need'
        ];

        if (!angular.equals(headers, expectedHeaders)) {
          var alert = 'Headers mismatch! Please make sure you have the correct headers in your file (check for correct spelling and capitalization): ';
          alert += '<br /><strong>';
          alert += expectedHeaders.join(',');
          alert += '</strong>';

          ctrl.information_needs.import.alert = alert;
        }
      };

      ctrl.checkInformationNeedsBody = function () {
        var lines = ctrl.information_needs.content.split('\n');
        var i = 1;
        var alert;
        for (i = 1; i < lines.length; i++) {
          var line = lines[i];
          if (line && line.split(ctrl.information_needs.separator).length > 2) {
            var matches = line.match(/"/g);
            if (matches !== undefined && matches !== null && matches.length >= 2) {
              // two double quotes (or more) means we are okay, it's not a perfect check
            } else {
              if (alert === undefined) {
                alert = 'Must have two (or fewer) columns for every line in CSV file.  Make sure to wrap any query and information_need with <code>,</code> in double quotes.';
                alert += '<br /><strong>';
              }
              alert += 'line ' + (i + 1) + ': ';
              alert += line;
              alert += '<br />';
            }
          }
        }
        if (alert !== undefined) {
          alert += '</strong>';
          ctrl.information_needs.import.alert = alert;
        }
      };
    }
  ]);
