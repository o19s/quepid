'use strict';

angular.module('QuepidApp')
  .controller('ExportCaseModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'querySnapshotSvc',
    'theCase',
    function ($scope, $uibModalInstance, querySnapshotSvc, theCase) {
      var ctrl = this;

      ctrl.theCase = theCase;

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
        which: 'undefined',
        snapshot: 'undefined'
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
    }
  ]);
