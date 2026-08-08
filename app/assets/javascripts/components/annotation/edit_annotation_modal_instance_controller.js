'use strict';

angular.module('QuepidApp')
  .controller('EditAnnotationModalInstanceCtrl', [
    '$scope',
    '$quepidModalInstance',
    'annotation',
    function ($scope, $quepidModalInstance, annotation) {
      var ctrl = this;
      ctrl.annotation = annotation;

      $scope.ok = function () {
        $quepidModalInstance.close(ctrl.annotation);
      };

      $scope.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
