'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ImportToCasesCtrl', [
    '$uibModal',
    'flash',
    function ($uibModal, flash) {
      var crtl = this;

      crtl.import = {};
      crtl.import.prompt = promptModal;

      function promptModal () {
        var modalInstance = $uibModal.open({
          templateUrl:  'import_to_cases/_modal.html',
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
    }
  ]);
