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
      $rootScope,
      $log,
      caseSvc,
      caseCSVSvc,
      queriesSvc,
      querySnapshotSvc
    ) {
      var ctrl = this;

      this.iconOnly = $rootScope.iconOnly;

      // If called from the cases listing page, $rootScope.theCase is populated,
      // otherwise on the main page get it from the caseSvc.
      if ($rootScope.theCase) {
        ctrl.theCase = $rootScope.theCase;
      }
      else {
        ctrl.theCase = caseSvc.getSelectedCase();
      }

      $rootScope.$on('caseSelected', function() {
        ctrl.theCase = caseSvc.getSelectedCase();
      });

      // Functions
      ctrl.exportCase = exportCase;
      ctrl.prompt     = prompt;

      function exportCase(options) {
        var csv, blob, snapshotId;

        if ( options.which === 'general' ) {
          $log.info('Selected "general" as export option.');
          $log.info(ctrl.theCase);
          csv  = caseCSVSvc.stringify(ctrl.theCase, true);
          blob = new Blob([csv], {
            type: 'text/csv'
          });

          /*global saveAs */
          saveAs(blob, caseCSVSvc.formatDownloadFileName(ctrl.theCase.caseName + '_general.csv'));
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

            var snapshot = querySnapshotSvc.snapshots[snapshotId];
            csv         = caseCSVSvc.stringifySnapshot(
              ctrl.theCase,
              snapshot,
              true
            );
            blob        = new Blob([csv], {
              type: 'text/csv'
            });

            /*global saveAs */
            saveAs(blob, caseCSVSvc.formatDownloadFileName(ctrl.theCase.caseName + '_snapshot.csv'));

          }, function (response) {
            $log.debug('error fetching snapshot:');
            $log.debug(response);
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
        else if ( options.which === 'rre' ) {
         $log.info('Selected "rre" as export option.');
         caseCSVSvc.exportRREFormat(ctrl.theCase);

        }
        else if ( options.which === 'ltr' ) {
         $log.info('Selected "ltr" as export option.');
         caseCSVSvc.exportLTRFormat(ctrl.theCase);

        }
      }

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'export_case/_modal.html',
          controller:   'ExportCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve:      {
            theCase: function() {
              return ctrl.theCase;
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
