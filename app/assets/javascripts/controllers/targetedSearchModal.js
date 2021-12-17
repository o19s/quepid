'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchModalCtrl', [
    '$scope', '$uibModalInstance', '$log',
    'query',
    function ($scope, $uibModalInstance, $log, query) {

      $scope.query = query;
      $scope.targetedSearchModalModel = {};
      $scope.enterKeyPressed = false;

      $log.debug('TargetedSearchModalCtrl - Initiated');

      $scope.targetedSearchModalModel.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
      };

      $scope.checkIfEnterKeyPressed = function(event){
        console.log (event.keyCode)
        if (event.keyCode === 13) {
          $scope.enterKeyPressed = true;
        }
        else {
          $scope.enterKeyPressed = false;
        }
      };
    }
  ]);
