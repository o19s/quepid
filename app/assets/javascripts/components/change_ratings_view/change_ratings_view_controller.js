'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('ChangeRatingsViewCtrl', [
    '$scope',
    '$uibModal',
    '$log',
    '$routeParams',
    'flash',
    'caseSvc',
    function (
      $scope,
      $uibModal,
      $log,
      $routeParams,
      flash,
      caseSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;


      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'change_ratings_view/_modal.html',
          controller:   'ChangeRatingsViewModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            acase: function() {
              return ctrl.acase;
            }
          }
        });

        modalInstance.result.then(
          function(acase) {
            caseSvc.changeRatingsView(acase)
              .then(function() {
                flash.success = 'Case rating view updated.';
              }, function() {
                flash.error = 'Unable to update case rating view.';
              });

          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
