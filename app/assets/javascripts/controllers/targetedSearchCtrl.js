'use strict';

angular.module('QuepidApp')
  .controller('TargetedSearchCtrl', [
    '$scope', '$quepidModal', '$log',
    function ($scope, $quepidModal, $log) {
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

        modalInstance.result.then(
          function() {
            //Then anything?
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      };
    }
  ]);
