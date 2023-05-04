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
      ctrl.archiveCase       = archiveCase;
      ctrl.openArchiveModal  = openArchiveModal;

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

      function openArchiveModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'archive_case/_modal.html',
          controller:   'ArchiveCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve:      {
            theCase: function() {
              return ctrl.thisCase;
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
