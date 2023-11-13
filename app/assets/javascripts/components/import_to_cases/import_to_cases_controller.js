'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportToCasesCtrl', [
    '$uibModal',
    'flash',
    function ($uibModal, flash) {
      var ctrl = this;

      ctrl.import = {};
      ctrl.import.promptModalSnapshot = promptModalSnapshot;
      ctrl.import.promptModalCase = promptModalCase;

      function promptModalSnapshot () {
        var modalInstance = $uibModal.open({
          templateUrl:  'import_to_cases/_modal_snapshot.html',
          controller:   'ImportSnapshotModalInstanceCtrl',
          controllerAs: 'ctrl',
        });

        modalInstance.result.then(
          function(result) {
            if ( result.success ) {
              flash.success = result.message;
            } else if (result.error ) {
              flash.error = result.message;
            }
          },
          function() { }
        );
      }
      
      function promptModalCase () {
        var modalInstance = $uibModal.open({
          templateUrl:  'import_to_cases/_modal_case.html',
          controller:   'ImportCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
        });

        modalInstance.result.then(
          function(result) {
            if ( result.success ) {
              flash.success = result.message;
            } else if (result.error ) {
              flash.error = result.message;
            }
          },
          function() { }
        );
      }
    }
  ]);
