'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('DeleteScorerCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'customScorerSvc',
    function (
      $scope,
      $uibModal,
      flash,
      customScorerSvc
    ) {
      var ctrl = this;

      ctrl.thisScorer       = $scope.thisScorer;
      ctrl.deleteScorer     = deleteScorer;
      ctrl.openDeleteModal  = openDeleteModal;

      function deleteScorer() {
        customScorerSvc.delete(ctrl.thisScorer)
        .then(function () {
            flash.success = 'Scorer deleted successfully.';
          },
          function (response) {
            flash.error = response.data.error;
          }
        );
      }

      function openDeleteModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'delete_scorer/_modal.html',
          controller:   'DeleteScorerModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {}
        });

        modalInstance.result.then(function (deleteClicked) {
          if( deleteClicked ){
            ctrl.deleteScorer();
          }
        });
      }
    }
  ]);
