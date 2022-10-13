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

      ctrl.sortJsonByKeys = function (obj) {
        var sortedJsonKeys = Object.keys(obj).sort();
        var tempObj = {};
        sortedJsonKeys.map(key => tempObj[key] = obj[key]);
        return angular.toJson(tempObj, true);
      };

      ctrl.parsedQueryDetails = ctrl.sortJsonByKeys(query.searcher.parsedQueryDetails);

      ctrl.queryDetailsMessage = null;
      // Only solr has this, not ES.  So a check if it exists.  It may just be empty {}.
      if (angular.isDefined(query.searcher.queryDetails)) {
        if (angular.equals(query.searcher.queryDetails,{})){
          ctrl.queryDetailsMessage = 'The list of query parameters used to construct the query was not returned by Solr.';
        }
        else {
          ctrl.queryDetails = ctrl.sortJsonByKeys(query.searcher.queryDetails);
        }
      }
      else {
        ctrl.queryDetailsMessage = 'Query parameters are not returned by the current Search Engine.';
      }

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };
    }
  ]);
