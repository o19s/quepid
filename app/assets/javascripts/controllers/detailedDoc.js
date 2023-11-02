'use strict';

angular.module('QuepidApp')
  .controller('DetailedDocCtrl', [
    '$scope', '$uibModalInstance',
    'doc',
    function DetailedDocCtrl($scope, $uibModalInstance, doc) {
      
      $scope.doc = doc;
      
      $scope.showAllFields = false;

      $scope.allFields = function() {
        return JSON.stringify($scope.doc.doc.origin(),null,2);
      };
      
      $scope.allFieldsFormatted = $scope.allFields();
      


      $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
