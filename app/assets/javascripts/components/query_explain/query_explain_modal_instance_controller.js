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

      ctrl.queryDetailsMessage = null;
      // Only solr has this, not ES.  So a check if it exists.  It may just be empty {}.
      if (angular.isDefined(query.searcher.queryDetails)) {
        if (angular.equals(query.searcher.queryDetails,{})){
          ctrl.queryDetailsMessage = 'The list of query parameters used to construct the query was not returned by Solr.';
        }
        else {
          ctrl.queryDetails = angular.toJson(query.searcher.queryDetails, true);
        }
      }
      else {
        ctrl.queryDetailsMessage = 'Query parameters are not returned by Elasticsearch.';
      }

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
