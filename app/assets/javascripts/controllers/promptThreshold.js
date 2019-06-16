'use strict';

angular.module('QuepidApp')
  .controller('PromptThresholdCtrl', [
    '$scope', '$uibModalInstance',
    'query',
    function($scope, $uibModalInstance, query) {

      $scope.Params = {};
      $scope.setThreshold = function() { };

      $scope.Params.threshold = query.threshold;
      $scope.Params.thresholdEnabled = query.thresholdEnabled;

      $scope.ok = function() {
        query.setThreshold($scope.Params.thresholdEnabled, $scope.Params.threshold);
        $uibModalInstance.close();
      };

      $scope.close = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
