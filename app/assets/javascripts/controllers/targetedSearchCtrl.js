'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchCtrl', [
    '$scope', '$quepidModal',
    function ($scope, $quepidModal) {
      $scope.targetedSearch = {};
      $scope.targetedSearch.triggerModal = function() {

        var modalInstance = $quepidModal.open({
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
