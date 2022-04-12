'use strict';

angular.module('QuepidApp')
  .controller('DeleteCaseOptionsModalInstanceCtrl', [
    '$uibModalInstance',
    'theCase',
    function ($uibModalInstance, theCase) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.options = {
        action:   null
      };

      ctrl.cannotDelete = function() {
        return ctrl.options.action === null;
      };

      ctrl.buttonName = function() {
        switch(ctrl.options.action) {
          case 'delete_all_queries':
            return "Delete All Queries";
          case 'archive_case':
            return "Archive";
          case 'delete_case':
            return "Delete";
          default:
            return "Delete";

        }
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.options);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
