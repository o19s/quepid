'use strict';

angular.module('QuepidApp')
  .controller('QueryExplainModalInstanceCtrl', [
    '$uibModalInstance',
    'query',
    function (
      $uibModalInstance,
      query
    ) {
      var ctrl = this;

      ctrl.query = query;

      ctrl.parsedQueryDetails = angular.toJson(query.searcher.parsedQueryDetails, true);

      if (angular.isDefined(query.searcher.queryDetails)) {
        ctrl.queryDetails = angular.toJson(query.searcher.queryDetails, true);
      }
      else {
        ctrl.queryDetails = '{"message":  "none provided"}'
      }

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
