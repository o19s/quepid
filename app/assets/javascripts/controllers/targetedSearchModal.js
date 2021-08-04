'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchModalCtrl', [
    '$scope', '$uibModalInstance', '$log',
    'query',
    function ($scope, $uibModalInstance, $log, query) {

      $scope.query = query;
      $scope.targetedSearchModalModel = {};
      $log.debug('TargetedSearchModalCtrl - Initiated');

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      $scope.targetedSearchModalModel.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
