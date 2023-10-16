'use strict';

angular.module('QuepidApp')
  .controller('UnarchiveSearchEndpointCtrl', [
    '$scope', '$uibModalInstance',
    'searchEndpointSvc','currentTeam',
    function ($scope, $uibModalInstance, searchEndpointSvc, currentTeam) {

      $scope.currentTeam = currentTeam; // can be null if we aren't looking at a current Team
      $scope.loading = true;
      searchEndpointSvc.fetchArchived($scope.currentTeam)
        .then(function() {
          $scope.loading = false;
        });

      $scope.archivedSearchEndpoints = function() {
          return searchEndpointSvc.archived;
      };

      $scope.selectedSearchEndpoint = null;
      $scope.toggleSelect = function(aSearchEndpoint) {
        if ($scope.selectedSearchEndpoint && aSearchEndpoint.id === $scope.selectedSearchEndpoint.id) {
          $scope.selectedSearchEndpoint = null;
        } else {
          $scope.selectedSearchEndpoint = aSearchEndpoint;
        }
      };

      $scope.isSelected = function(aSearchEndpoint) {
        return $scope.selectedSearchEndpoint && $scope.selectedSearchEndpoint.id === aSearchEndpoint.id;
      };

      $scope.addBackSearchEndpoint = function(aSearchEndpoint) {
        searchEndpointSvc.unarchiveSearchEndpoint(aSearchEndpoint)
        .then(function() {
          $uibModalInstance.dismiss('addBackSearchEndpoint');
        });
      };

      $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

    }
  ]);
