'use strict';

angular.module('QuepidApp')
  .controller('QueryParamsCtrl', [
    '$scope',
    'TryFactory',
    function ($scope, TryFactory) {
      $scope.qp = {};
      $scope.qp.curTab = 'developer';

      $scope.qp.toggleTab = function(a) {
        $scope.qp.curTab = a;

        // For some reason when we call `updateVars()` on the original
        // try the `queryParams` attribute does not maintain its new value
        // and reverts to the old value.
        // So instead we are creating a tmp variable to use.
        var tmp = new TryFactory({
          args:          $scope.settings.selectedTry.args,
          curatorVars:   $scope.settings.selectedTry.curatorVarsDict(),
          escapeQuery:   $scope.settings.selectedTry.escapeQuery,
          fieldSpec:     $scope.settings.selectedTry.fieldSpec,
          name:          $scope.settings.selectedTry.name,
          numberOfRows:  $scope.settings.selectedTry.numberOfRows,
          queryParams:   $scope.settings.selectedTry.queryParams,
          queryJson:     $scope.settings.selectedTry.queryJson,
          searchEngine:  $scope.settings.selectedTry.searchEngine,
          searchUrl:     $scope.settings.selectedTry.searchUrl,
          tryNo:         $scope.settings.selectedTry.tryNo,
          requestHasQueryString: $scope.settings.selectedTry.requestHasQueryString,
          requestHasJsonBody: $scope.settings.selectedTry.requestHasJsonBody,
        });
        tmp.updateVars();
        $scope.settings.selectedTry = tmp;
      };
    }
  ]);
