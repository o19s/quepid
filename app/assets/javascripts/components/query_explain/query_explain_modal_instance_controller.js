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

      // default to showing the params toggle.
      ctrl.toggleParams = true;

      ctrl.query = query;

      var sortedJsonKeys = Object.keys(query.searcher.parsedQueryDetails).sort();
      var tempObj = {};

      sortedJsonKeys.map(key => tempObj[key] = query.searcher.parsedQueryDetails[key])

      ctrl.parsedQueryDetails = angular.toJson(tempObj, true);

      ctrl.queryDetailsMessage = null;
      // Only solr has this, not ES.  So a check if it exists.  It may just be empty {}.
      if (angular.isDefined(query.searcher.queryDetails)) {
        if (angular.equals(query.searcher.queryDetails,{})){
          ctrl.queryDetailsMessage = 'The list of query parameters used to construct the query was not returned by Solr.';
        }
        else {
          var sortedJsonKeys = Object.keys(query.searcher.queryDetails).sort();
          var tempObj = {};

          sortedJsonKeys.map(key => tempObj[key] = query.searcher.queryDetails[key])
          ctrl.queryDetails = angular.toJson(tempObj, true);
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
