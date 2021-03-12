'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('ArchiveCaseCtrl', [
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

      ctrl.thisCase          = $scope.thisCase;
      ctrl.checkIfOnlyCase   = checkIfOnlyCase;
      ctrl.archiveCase       = archiveCase;
      ctrl.openArchiveModal  = openArchiveModal;
      ctrl.retrieveTooltip   = retrieveTooltip;

      function archiveCase() {
        caseSvc.archiveCase(ctrl.thisCase).then(
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

      function openArchiveModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'archive_case/_modal.html',
          controller:   'ArchiveCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {
            onlyCase: function() {
              return ctrl.checkIfOnlyCase();
            }
          }
        });

        modalInstance.result.then(function (archiveClicked) {
          if( archiveClicked ){
            ctrl.archiveCase();
          }
        });
      }
    }
  ]);
