'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('DeleteCaseCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'caseSvc',
    function (
      $scope,
      $uibModal,
      flash,
      caseSvc
    ) {
      var ctrl = this;

      ctrl.thisCase         = $scope.thisCase;
      ctrl.deleteCase       = deleteCase;
      ctrl.openDeleteModal  = openDeleteModal;

      function deleteCase() {
        caseSvc.deleteCase(ctrl.thisCase).then(
          function () {
            flash.success = 'Case deleted successfully.';
          }, function (data) {
            var message = 'Oooops! Could not delete the case. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function openDeleteModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'delete_case/_modal.html',
          controller:   'DeleteCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {}
        });

        modalInstance.result.then(function (deleteClicked) {
          if( deleteClicked ){
            ctrl.deleteCase();
          }
        });
      }
    }
  ]);
