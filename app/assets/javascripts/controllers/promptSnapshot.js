'use strict';

angular.module('QuepidApp')
  .controller('PromptSnapshotCtrl', [
    '$scope', '$uibModalInstance',
    'flash',
    'queriesSvc', 'querySnapshotSvc',
    function(
      $scope, $uibModalInstance,
      flash,
      queriesSvc, querySnapshotSvc
    ) {

      $scope.snapPrompt = {name: '', inProgress: false, error: null};

      $scope.ok = function() {
        $scope.snapPrompt.inProgress  = true;
        $scope.snapPrompt.error       = null;

        querySnapshotSvc.addSnapshot($scope.snapPrompt.name, queriesSvc.queryArray())
        .then(function() {
          $scope.snapPrompt.inProgress = false;
          $uibModalInstance.close();

          flash.success = 'Snapshot created successfully.';
        }, function(response) {
          $scope.snapPrompt.inProgress  = false;
          $scope.snapPrompt.error       = response.data.statusText;
        });
      };

      $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
