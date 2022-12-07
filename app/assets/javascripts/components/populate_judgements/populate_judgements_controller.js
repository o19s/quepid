'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('PopulateJudgementsCtrl', [
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
          templateUrl:  'populate_judgements/_modal.html',
          controller:   'PopulateJudgementsModalInstanceCtrl',
          controllerAs: 'ctrl',
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
