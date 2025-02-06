'use strict';

angular.module('QuepidApp')
  .controller('ArchiveSearchEndpointModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    'theSearchEndpoint',
    function ($rootScope, $uibModalInstance, theSearchEndpoint) {
      var ctrl = this;

      ctrl.theSearchEndpoint = theSearchEndpoint;

      ctrl.ok = function () {
        $uibModalInstance.close(true);
      };

      ctrl.cancel = function () {
        $uibModalInstance.close(false);
      };

    }
  ]);
