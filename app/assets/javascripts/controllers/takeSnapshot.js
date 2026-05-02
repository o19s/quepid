'use strict';

angular.module('QuepidApp')
  .controller('TakeSnapshotCtrl', [
    '$scope', '$quepidModal', '$log',
    function ($scope, $quepidModal, $log) {
      $scope.snapshot = {};
      $scope.snapshot.prompt = function() {

        var modalInstance = $quepidModal.open({
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
