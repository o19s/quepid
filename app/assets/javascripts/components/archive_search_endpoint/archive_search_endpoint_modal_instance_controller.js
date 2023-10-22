'use strict';

angular.module('QuepidApp')
  .controller('ArchiveSearchEndpointModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    'theSearchEndpoint',
    function ($rootScope, $uibModalInstance, theSearchEndpoint) {
      var ctrl = this;

      ctrl.theSearchEndpoint = theSearchEndpoint;
      //ctrl.canDelete = false;
      ctrl.canDelete = true; // hard code that anyone can delete ;-(

      //$rootScope.$watch('currentUser', function() {
      //  if ( $rootScope.currentUser ) {
      //    ctrl.canDelete = $rootScope.currentUser.permissions.search_endpoint.delete;
      //  }
      //});

      ctrl.isOwnerOfSearchEndpoint = function() {
        return ($rootScope.currentUser.id === ctrl.theSearchEndpoint.ownerId);
      };

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
