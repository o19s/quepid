'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchModalCtrl', [
    '$scope', '$quepidModalInstance', '$log',
    'query',
    function ($scope, $quepidModalInstance, $log, query) {

      $scope.query = query;
      $scope.targetedSearchModalModel = {};

      $log.debug('TargetedSearchModalCtrl - Initiated');

      $scope.targetedSearchModalModel.closeModal = function() {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
