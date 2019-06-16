'use strict';

angular.module('QuepidApp')
  .controller('UnarchiveCaseCtrl', [
    '$scope', '$uibModalInstance',
    'caseSvc',
    function ($scope, $uibModalInstance, caseSvc) {

      $scope.selectedCase = 'football';

      $scope.loading = true;
      caseSvc.fetchArchived()
        .then(function() {
          $scope.loading = false;
        });

      $scope.archivedCases = function() {
        return caseSvc.archived;
      };

      $scope.selectedCase = null;
      $scope.toggleSelect = function(aCase) {
        if ($scope.selectedCase && aCase.caseNo === $scope.selectedCase.caseNo) {
          $scope.selectedCase = null;
        } else {
          $scope.selectedCase = aCase;
        }
      };

      $scope.isSelected = function(aCase) {
        return $scope.selectedCase && $scope.selectedCase.caseNo === aCase.caseNo;
      };

      $scope.addBackCase = function(aCase) {
        caseSvc.undeleteCase(aCase)
        .then(function() {
          $uibModalInstance.dismiss('addBackCase');
        });
      };

      $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

    }
  ]);
