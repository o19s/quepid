'use strict';

angular.module('QuepidApp')
  .controller('ArchiveCaseModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    'theCase',
    function ($rootScope, $uibModalInstance, theCase) {
      var ctrl = this;

      ctrl.theCase = theCase;
      ctrl.canDelete = false;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.canDelete = $rootScope.currentUser.permissions.case.delete;
        }
      });

      ctrl.isOwnerOfCase = function() {
        return ($rootScope.currentUser.id === ctrl.theCase.ownerId);
      }

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
