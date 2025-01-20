'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DiffModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    '$log',
    'flash',
    'querySnapshotSvc', 'queryViewSvc', 'queriesSvc', 'initialSelection',
    function(
      $scope,
      $uibModalInstance,
      $log,
      flash,
      querySnapshotSvc, queryViewSvc, queriesSvc, initialSelection
    ) {
      var ctrl = this;

      querySnapshotSvc.getSnapshots().then(function() {
          ctrl.snapshots = querySnapshotSvc.snapshots;
        }
      );
        
      ctrl.which      = 'snapshot';
      ctrl.selection  = initialSelection;
      ctrl.inProgress = false;

      // Functions
      ctrl.cancel          = cancel;
      ctrl.delConfirm      = delConfirm;
      ctrl.delStarted      = delStarted;
      ctrl.nothingSelected = nothingSelected;
      ctrl.ok              = ok;
      ctrl.toggleDel       = toggleDel;
      ctrl.isProcessingFile = isProcessingFile;
      

      // Watches
      $scope.$watch('ctrl.selection', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          ctrl.which = 'snapshot';
        }
      });

      // Init
      if (initialSelection === null) {
        ctrl.which = 'none';
      }

      var delState = null;
      function toggleDel(snapId) {
        if (delState === null) {
          delState = snapId;
        } else {
          delState = null;
        }
      }

      function delStarted() {
        return (delState !== null);
      }

      function delConfirm() {
        querySnapshotSvc.deleteSnapshot(delState)
          .then(function() {
            delState = null;
            ctrl.which = 'none';

            queryViewSvc.reset();
            queriesSvc.setDiffSetting(null);

            flash.success = 'Snapshot deleted successfully.';
          });
      }
      
      function isProcessingFile() {
        if (ctrl.snapshots){
          var desiredSnapshot = null;
          angular.forEach(ctrl.snapshots, function(snapshot) {
            if (snapshot.id === ctrl.selection) {
              desiredSnapshot = snapshot;
              return; // exit the loop early
            }
          });
          if (desiredSnapshot){
            return desiredSnapshot.hasSnapshotFile;
          }
          else {
            return false;
          }
        }
        return false;
      }

      function nothingSelected() {
        if (  ctrl.which === 'snapshot' &&
              ( angular.isUndefined(ctrl.selection) ||
                ctrl.selection === null )
        ) {
          return true;
        }

        return false;
      }

      function ok() {
        if (ctrl.which === 'none') {
          $uibModalInstance.close(null);
        } else {
          ctrl.inProgress = true;
          querySnapshotSvc.get(ctrl.selection)
            .then(function() {
              ctrl.inProgress = false;
              $uibModalInstance.close(ctrl.selection);
              flash.success = 'Snapshot loaded successfully.';
            }, function (response) {
              flash.error = 'Could note fetch snapshot!';
              $log.debug('error fetching snapshot:');
              $log.debug(response);
            });
        }
      }

      function cancel() {
        $uibModalInstance.dismiss('cancel');
      }
    }
  ]);
