'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('ChangeRatingsViewCtrl', [
    '$scope',
    '$uibModal',
    '$log',
    '$routeParams',
    'flash',
    function (
      $scope,
      $uibModal,
      $log,
      $routeParams,
      flash,
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
            var caseNo  = share.acase.caseNo;
            var ratingsView = share.acase.ratingsView;
            caseSvc.changeRatingsView(caseNo, ratingsView)
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
