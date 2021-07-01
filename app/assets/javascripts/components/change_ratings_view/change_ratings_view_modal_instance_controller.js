'use strict';

angular.module('QuepidApp')
  .controller('ChangeRatingsViewModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    '$log',
    '$location',
    'acase',
    function (
      $scope,
      $uibModalInstance,
      $log,
      $location,
      acase
     ) {
      var ctrl = this;
      this.acase = acase;

      ctrl.ratingViews = ['individual','consolidated'];

      ctrl.selectRatingView = function(ratingView) {
        ctrl.acase.ratingsView = ratingView;
      };


      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.acase);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

    }
  ]);
