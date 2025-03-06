'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('DeleteSearchEndpointCtrl', [
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

      ctrl.thisSearchEndpoint         = $scope.thisSearchEndpoint;
      ctrl.deleteSearchEndpoint       = deleteSearchEndpoint;
      ctrl.openDeleteModal  = openDeleteModal;

      function deleteSearchEndpoint() {
        searchEndpointSvc.deleteSearchEndpoint(ctrl.thisSearchEndpoint).then(
          function () {
            flash.success = 'Search Endpoint deleted successfully.';
          }, function (data) {
            var message = 'Oooops! Could not delete the Search Endpoint. ';
            message += data.message;
            flash.error = message;
          }
        );
      }

      function openDeleteModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'delete_search_endpoint/_modal.html',
          controller:   'DeleteSearchEndpointModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {}
        });

        modalInstance.result.then(function (deleteClicked) {
          if( deleteClicked ){
            ctrl.deleteSearchEndpoint();
          }
        });
      }
    }
  ]);
