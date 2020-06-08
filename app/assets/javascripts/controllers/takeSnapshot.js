'use strict';

angular.module('QuepidApp')
  .controller('TakeSnapshotCtrl', [
    '$scope', '$uibModal', '$log',
    function ($scope, $uibModal, $log) {
      $scope.snapshot = {};
      $scope.snapshot.prompt = function() {

        var modalInstance = $uibModal.open({
          templateUrl: 'views/snapshotModal.html',
          controller: 'PromptSnapshotCtrl',
        });

        modalInstance.result.then(function() {
          // take the snapshot over all the active queries
          $log.debug('Creating snapshot: ');
        },function() {
          $log.info('INFO: Modal dismissed');
        });
      };
    }
  ]);
