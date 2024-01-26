'use strict';

angular.module('QuepidApp')
  .controller('ExportCaseModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'querySnapshotSvc',
    'theCase',
    'supportsDetailedExport',
    function ($scope, $uibModalInstance, querySnapshotSvc, theCase, supportsDetailedExport) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.supportsDetailedExport = supportsDetailedExport;
      ctrl.isProcessingFile = isProcessingFile;

      // If called from the cases listing page, then we need the call back with the bootstrap,
      // otherwise on the main page the querySnapshotSvc.snapshots was bootstrapped.
      ctrl.snapshots = querySnapshotSvc.snapshots;
      if (ctrl.theCase.caseNo !== querySnapshotSvc.getCaseNo()){
        querySnapshotSvc.bootstrap(ctrl.theCase.caseNo).then(function() {
            ctrl.snapshots = querySnapshotSvc.snapshots;
          }
        );
      }

      ctrl.options = {
        which: undefined,
        snapshot: undefined
      };

      // Watches
      $scope.$watch('ctrl.options', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          if (oldVal.snapshot_snapshot !== newVal.snapshot_snapshot) {
            ctrl.options.which = 'snapshot';
          }
          else if (oldVal.basic_snapshot !== newVal.basic_snapshot) {
            ctrl.options.which = 'basic';
          }
        }
      },true);

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.options);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
      
      
      function isProcessingFile() {
        if (ctrl.options.snapshot){
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
    }
  ]);
