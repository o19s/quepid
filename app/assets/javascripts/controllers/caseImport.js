'use strict';

angular.module('QuepidApp')
  .controller('CasesImportCtrl', [
    '$scope',
    'caseSvc',
    function ($scope, caseSvc) {
      $scope.caseImport = {src: ''};
      $scope.caseImport.submit = function() {
        $scope.caseImport.success = $scope.caseImport.error = '';
        var jsonSrc = angular.fromJson($scope.caseImport.src);
        caseSvc.createCase(jsonSrc.caseName, jsonSrc.queries, jsonSrc.tries);
      };
    }
  ]);
