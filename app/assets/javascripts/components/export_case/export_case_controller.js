'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ExportCaseCtrl', [
    '$uibModal',
    '$scope',
    '$log',
    'caseSvc',
    'caseCSVSvc',
    'queriesSvc',
    'querySnapshotSvc',
    function (
      $uibModal,
      $scope,
      $log,
      caseSvc,
      caseCSVSvc,
      queriesSvc,
      querySnapshotSvc
    ) {
      var ctrl = this;

      this.iconOnly = $scope.iconOnly;
      this.supportsDetailedExport = $scope.supportsDetailedExport;

      // If called from the cases listing page, $scope.theCase is populated,
      // otherwise on the main page get it from the caseSvc.
      if ($scope.theCase) {
        ctrl.theCase = $scope.theCase;
      }
      else {
        ctrl.theCase = caseSvc.getSelectedCase();
      }

      $scope.$on('caseSelected', function() {
        ctrl.theCase = caseSvc.getSelectedCase();
      });

      // Functions
      ctrl.exportCase = exportCase;
      ctrl.prompt     = prompt;

      function exportCase(options) {
        var csv, blob, snapshotId;

        if ( options.which === 'general' ) {
          $log.info('Selected "general" as export option.');

          // Go back to the API in case other users have updates that we should include.
          caseSvc.get(ctrl.theCase.caseNo, false).then(function(acase) {
            csv  = caseCSVSvc.stringify(acase, true);
            blob = new Blob([csv], {
              type: 'text/csv'
            });

            /*global saveAs */
            saveAs(blob, caseCSVSvc.formatDownloadFileName(acase.caseName + '_general.csv'));
          });
        } else if ( options.which === 'detailed' ) {
          $log.info('Selected "detailed" as export option.');

          var queries = queriesSvc.queries;
          csv         = caseCSVSvc.stringifyQueriesDetailed(
            ctrl.theCase,
            queries,
            true
          );
          blob        = new Blob([csv], {
            type: 'text/csv'
          });

          /*global saveAs */
          saveAs(blob, caseCSVSvc.formatDownloadFileName(ctrl.theCase.caseName + '_detailed.csv'));
        }
        else if ( options.which === 'snapshot' ) {
          $log.info('Selected "snapshot" as export option.');
          $log.info('Exporting snapshot ' + options.snapshot_snapshot + '.');
          snapshotId = options.snapshot_snapshot;
          // Snapshot Name	Snapshot Time	Case ID	Query Text	Doc ID	Doc Position

          querySnapshotSvc.get(snapshotId).then(function() {
            $log.info("got snapshot" + snapshotId);
            var snapshot = querySnapshotSvc.snapshots[snapshotId];
            csv         = caseCSVSvc.stringifySnapshot(
              ctrl.theCase,
              snapshot,
              true
            );
            $log.info("csv is " + csv);
            blob        = new Blob([csv], {
              type: 'text/csv'
            });
            $log.info('saving blob ' + blob + '.');
            $log.info("downlaod name: " + caseCSVSvc.formatDownloadFileName(ctrl.theCase.caseName + '_snapshot.csv'));
            /*global saveAs */
            saveAs(blob, caseCSVSvc.formatDownloadFileName(ctrl.theCase.caseName + '_snapshot.csv'));

          }, function (response) {
            $log.info('error fetching snapshot:');
            $log.info(response);
          });

        }
        else if ( options.which === 'basic' ) {
         $log.info('Selected "basic" as export option.');
         snapshotId = options.basic_snapshot;

         if (snapshotId === undefined){
           caseCSVSvc.exportBasicFormat(ctrl.theCase);
         }
         else {
            caseCSVSvc.exportBasicFormatSnapshot(ctrl.theCase, snapshotId);
         }

        }
        else if ( options.which === 'trec' ) {
         $log.info('Selected "trec" as export option.');
         snapshotId = options.basic_snapshot;

         if (snapshotId === undefined){
           caseCSVSvc.exportTrecFormat(ctrl.theCase);
         }
         else {
            caseCSVSvc.exportTrecFormatSnapshot(ctrl.theCase, snapshotId);
         }

        }
        else if ( options.which === 'rre' ) {
         $log.info('Selected "rre" as export option.');
         caseCSVSvc.exportRREFormat(ctrl.theCase);

        }
        else if ( options.which === 'ltr' ) {
         $log.info('Selected "ltr" as export option.');
         caseCSVSvc.exportLTRFormat(ctrl.theCase);

        }
        else if ( options.which === 'information_need' ) {
         $log.info('Selected "information_need" as export option.');
         caseCSVSvc.exportInformationNeed(ctrl.theCase);

        }
      }

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'export_case/_modal.html',
          controller:   'ExportCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve:      {
            theCase: function() {
              return ctrl.theCase;
            },
            supportsDetailedExport: function() {
              return ctrl.supportsDetailedExport;
            }
          }
        });

        modalInstance.result.then(
          function (options) {
            ctrl.exportCase(options);
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
