'use strict';

angular.module('QuepidApp')
  .controller('UnarchiveCaseCtrl', [
    '$scope', '$uibModalInstance',
    'caseSvc','currentTeam',
    function ($scope, $uibModalInstance, caseSvc, currentTeam) {

      $scope.currentTeam = currentTeam; // can be null if we aren't looking at a current Team
      $scope.loading = true;
      caseSvc.fetchArchived()
        .then(function() {
          $scope.loading = false;
        });

      $scope.archivedCases = function() {
        if ($scope.currentTeam){
          var matches = [];
          for (let i = 0; i < caseSvc.archived.length; i++) {
            for (let j = 0; j < caseSvc.archived[i].teams.length; j++) {
              if (caseSvc.archived[i].teams[j].id === $scope.currentTeam.id){
                matches.push(caseSvc.archived[i]);
                break;
              }
            }
          }
          return matches;
        }
        else {
          return caseSvc.archived;
        }
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
        caseSvc.unarchiveCase(aCase)
        .then(function() {
          $uibModalInstance.dismiss('addBackCase');
        });
      };

      $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

    }
  ]);
