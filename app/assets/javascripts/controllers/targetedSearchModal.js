'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchModalCtrl', [
    '$scope', '$uibModalInstance', '$log',
    'query',
    function ($scope, $uibModalInstance, $log, query) {

      $scope.query = query;
      $scope.targetedSearchModalModel = {};
      $log.debug('TargetedSearchModalCtrl - Initiated');

      $scope.targetedSearchModalModel.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
