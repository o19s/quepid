'use strict';

angular.module('QuepidApp')
  .controller('EditAnnotationModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    'annotation',
    function ($scope, $uibModalInstance, annotation) {
      var ctrl = this;
      ctrl.annotation = annotation;

      $scope.ok = function () {
        $uibModalInstance.close(ctrl.annotation);
      };

      $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
