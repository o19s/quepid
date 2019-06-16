'use strict';

angular.module('QuepidApp')
  .controller('DetailedDocCtrl', [
    '$scope', '$uibModalInstance',
    'doc',
    function DetailedDocCtrl($scope, $uibModalInstance, doc) {
      // this controller is a bit silly just because
      // modals need their own controller
      $scope.doc = doc;

      $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
