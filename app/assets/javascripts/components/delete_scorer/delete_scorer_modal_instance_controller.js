'use strict';

angular.module('QuepidApp')
  .controller('DeleteScorerModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    function ($rootScope, $uibModalInstance) {
      var ctrl = this;

      // the whole canDelete this may not make sense to have as we don't really support 
      // changing up these permissions..
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
