'use strict';

angular.module('QuepidApp')
  .controller('DeleteScorerModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    function ($rootScope, $uibModalInstance) {
      var ctrl = this;

      ctrl.canDelete = false;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.canDelete = $rootScope.currentUser.permissions.scorer.delete;
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
