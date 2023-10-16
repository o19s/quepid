'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('ArchiveSearchEndpointCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'searchEndpointSvc',
    function (
      $scope,
      $uibModal,
      flash,
      searchEndpointSvc
    ) {
      var ctrl = this;

      ctrl.thisSearchEndpoint     = $scope.thisSearchEndpoint;
      ctrl.archiveSearchEndpoint  = archiveSearchEndpoint;
      ctrl.openArchiveModal       = openArchiveModal;

      function archiveSearchEndpoint() {
        searchEndpointSvc.archiveSearchEndpoint(ctrl.thisSearchEndpoint).then(
          function () {
            flash.success = 'Search endpoint archived successfully.';
          }, function (data) {
            var message = 'Oooops! Could not archive the search endpoint. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function openArchiveModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'archive_search_endpoint/_modal.html',
          controller:   'ArchiveSearchEndpointModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve:      {
            theSearchEndpoint: function() {
              return ctrl.thisSearchEndpoint;
            }
          }
        });

        modalInstance.result.then(function (archiveClicked) {
          if( archiveClicked ){
            ctrl.archiveSearchEndpoint();
          }
        });
      }
    }
  ]);
