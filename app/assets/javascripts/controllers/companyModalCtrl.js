'use strict';

 /*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('CompanyModalCtrl', [
    '$rootScope',
    '$scope',
    '$uibModalInstance',
    function (
      $rootScope,
      $scope,
      $uibModalInstance
    ) {
      $scope.company = {
        name: '',
      };

      $rootScope.$watch('currentUser', function() {
        $scope.company.name = $rootScope.currentUser.company;
      });

      // functions
      $scope.ok = ok;

      function ok() {
        $uibModalInstance.close($scope.company.name);
      }
    }
  ]);
