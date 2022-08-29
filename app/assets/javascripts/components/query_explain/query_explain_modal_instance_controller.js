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

      ctrl.copyText = null;

      ctrl.query = query;

      ctrl.sortJsonByKeys = function (obj) {
        var sortedJsonKeys = Object.keys(obj).sort();
        var tempObj = {};
        sortedJsonKeys.map(key => tempObj[key] = obj[key]);
        return angular.toJson(tempObj, true);
      };

      ctrl.formatJson = function (obj) {
        var jsonKeys = Object.keys(obj);
        var tempObj = {};
        jsonKeys.map(key => tempObj[key] = obj[key]);
        return angular.toJson(tempObj, true);
      };

      ctrl.parsedQueryDetails = ctrl.sortJsonByKeys(query.searcher.parsedQueryDetails);
      ctrl.timingDetails = ctrl.formatJson(query.searcher.timingDetails);



      ctrl.queryDetailsMessage = null;
      // Only solr has this, not ES.  So a check if it exists.  It may just be empty {}.
      if (angular.isDefined(query.searcher.queryDetails)) {
        if (angular.equals(query.searcher.queryDetails,{})){
          ctrl.queryDetailsMessage = 'The list of query parameters used to construct the query was not returned by Solr.';
        }
        else {
          ctrl.queryDetails = ctrl.sortJsonByKeys(query.searcher.queryDetails);
          ctrl.copyText = ctrl.queryDetails;
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
