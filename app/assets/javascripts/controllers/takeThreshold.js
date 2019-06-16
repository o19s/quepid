'use strict';

angular.module('QuepidApp')
  .controller('TakeThresholdCtrl', [
    '$scope', '$uibModal', '$log',
    function ($scope, $uibModal, $log) {
      $scope.snapshot = {};
      $scope.snapshot.prompt = function() {

        var modalInstance = $uibModal.open({
          templateUrl: 'views/thresholdModal.html',
          controller: 'PromptThresholdCtrl',
          resolve: {
            query: function() {
              return $scope.query;
            }
          }
        });

        modalInstance.result.then(function() {
          // take the snapshot over all the active queries
          $log.debug('Creating snapshot: ');
        });

      };
    }
  ]);
