'use strict';

angular.module('QuepidApp')
  .controller('DeleteCaseModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    'onlyCase',
    function ($rootScope, $uibModalInstance, onlyCase) {
      var ctrl = this;

      ctrl.onlyCase = onlyCase;

      ctrl.canDelete = false;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          console.log($rootScope.currentUser.permissions.case)
          ctrl.canDelete = $rootScope.currentUser.permissions.case.delete;
        }
      });

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
