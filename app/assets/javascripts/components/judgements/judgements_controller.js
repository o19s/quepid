'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('JudgementsCtrl', [
    '$scope',
    '$uibModal',
    '$log',
    function (
      $scope,
      $uibModal,
      $log
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'judgements/_modal.html',
          controller:   'JudgementsModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
          resolve: {
            acase: function() {
              return ctrl.acase;
            }
          }
        });

        modalInstance.result.then(
          function() {

          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
