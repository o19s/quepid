'use strict';

angular.module('QuepidApp')
  .controller('QueryExplainModalInstanceCtrl', [
    '$quepidModalInstance',
    '$log',
    'query',
    function (
      $quepidModalInstance,
      $log,
      query
    ) {
      let ctrl = this;

      // default to showing the params panels.
      ctrl.toggledPanel = 'queryDetails';

      ctrl.togglePanel = function(panel) {
        ctrl.toggledPanel = panel;
      };

      ctrl.query = query;
      ctrl.isTemplatedQuery = false;

      ctrl.sortJsonByKeys = function (obj) {
        let sortedJsonKeys = Object.keys(obj).sort();
        let tempObj = {};
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

      ctrl.renderQueryTemplate = function(){
        // Templated queries (the /template call format) are an ES/OS-only concept - other
        // engines' searchers don't define isTemplateCall/renderTemplate at all, so calling them
        // unconditionally throws. ctrl.isTemplatedQuery already defaults to false, which the
        // template correctly renders as "This is not a templated query."
        // Not in settingsSvc (unlike queriesSvc.trySupportsRatedDocsLookup): isTemplateCall is a
        // method on the already-built searcher instance, not a static per-engine setting.
        if (!angular.isDefined(query.searcher.isTemplateCall)) {
          return;
        }

        ctrl.isTemplatedQuery = query.searcher.isTemplateCall(query.searcher.args);

        query.searcher.renderTemplate().then(function() {
          ctrl.renderedQueryTemplate = angular.toJson(query.searcher.renderedTemplateJson.template_output,true);
          ctrl.togglePanel('renderedQueryTemplate');
        }, function(response) {
          $log.debug(response.data);
        });
      };

      ctrl.cancel = function () {
        $quepidModalInstance.dismiss('cancel');
      };
    }
  ]);
