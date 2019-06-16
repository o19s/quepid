'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchCtrl', [
    '$scope', '$uibModal',
    function ($scope, $uibModal) {
      $scope.targetedSearch = {};
      $scope.targetedSearch.triggerModal = function() {

        var modalInstance = $uibModal.open({
          templateUrl: 'views/targetedSearchModal.html',
          controller: 'TargetedSearchModalCtrl',
          size: 'lg',
          resolve: {
            query: function(){
              return $scope.query;
            }
          }
        });

        modalInstance.result.then(function() {
          //Then anything?
        });
      };
    }
  ]);
