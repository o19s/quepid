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
      ctrl.checkIfOnlyCase  = checkIfOnlyCase;
      ctrl.deleteCase       = deleteCase;
      ctrl.openDeleteModal  = openDeleteModal;
      ctrl.retrieveTooltip  = retrieveTooltip;

      function deleteCase() {
        caseSvc.deleteCase(ctrl.thisCase).then(
          function () {
            flash.success = 'Case archived successfully.';
          }, function (data) {
            var message = 'Oooops! Could not archive the case. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function checkIfOnlyCase() {
        var ownedCases = caseSvc.filterCases(caseSvc.allCases, true);

        if( ownedCases.length <= 1 ){
          return true;
        }

        return false;
      }

      function retrieveTooltip() {
        if(ctrl.checkIfOnlyCase()){
          return 'Can\'t archive the only case';
        } else {
          return 'Archive';
        }
      }

      function openDeleteModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'delete_case/_modal.html',
          controller:   'DeleteCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {
            onlyCase: function() {
              return ctrl.checkIfOnlyCase();
            }
          }
        });

        modalInstance.result.then(function (deleteClicked) {
          if( deleteClicked ){
            ctrl.deleteCase();
          }
        });
      }
    }
  ]);
