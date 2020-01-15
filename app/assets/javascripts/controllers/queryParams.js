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
        // UGH, this temp requires mapping back to API format of the data!
        var tmp = new TryFactory({
          args:          $scope.settings.selectedTry.args,
          curatorVars:   $scope.settings.selectedTry.curatorVarsDict(),
          escape_query:   $scope.settings.selectedTry.escapeQuery,
          field_spec:     $scope.settings.selectedTry.fieldSpec,
          name:          $scope.settings.selectedTry.name,
          numberOfRows:  $scope.settings.selectedTry.numberOfRows,
          query_params:   $scope.settings.selectedTry.queryParams,
          search_engine:  $scope.settings.selectedTry.searchEngine,
          search_url:     $scope.settings.selectedTry.searchUrl,
          try_number:     $scope.settings.selectedTry.tryNo,
        });
        tmp.updateVars();
        $scope.settings.selectedTry = tmp;
      };
    }
  ]);
