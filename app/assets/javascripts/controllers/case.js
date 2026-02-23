'use strict';

angular.module('QuepidApp')
  .controller('CaseCtrl', [
    '$scope', '$uibModal', '$log',
    'caseSvc',
    function (
      $scope, $uibModal, $log,
      caseSvc
    ) {
      $scope.caseModel = {};
      $scope.caseModel.cases = caseSvc.allCases;
      $scope.caseModel.dropdownCases = caseSvc.dropdownCases;
      $scope.caseModel.reorderEnabled = false;
      $scope.scores  = [];
      $scope.theCase = caseSvc.getSelectedCase();
      
      $scope.updateNightly = function () {
        caseSvc.updateNightly($scope.theCase);
      };
      
      $scope.caseName = {
        name: null,
        startRename: false,
        rename: function() {
          caseSvc.renameCase($scope.theCase, $scope.caseName.name)
          .then(function() {
            $scope.caseName.startRename = false;
          });
        },
        cancel: function() {
          $scope.caseName.startRename = false;
          $scope.caseName.name = $scope.caseModel.selectedCase().caseName;
        }
      };

      $scope.caseNameEditModeToggle = function(){
        $scope.caseName.name = $scope.caseModel.selectedCase().caseName;
        $scope.caseName.startRename = !$scope.caseName.startRename;
      };

      $scope.$watch(function() { return caseSvc.getSelectedCase(); }, function(aCase) {
        if (aCase) {
          $scope.theCase = aCase;
          $scope.scores  = aCase.scores;
        }
      });

      $scope.caseModel.selectedCase = function() {
        if (caseSvc.isCaseSelected()) {
          return caseSvc.getSelectedCase();
        }
        else {
          return { caseNo: -1, caseName: '' };
        }
      };

      $scope.caseModel.caseLoaded = function() {
        return $scope.caseModel.selectedCase().caseNo !== -1;
      };
    }
  ]);
