'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryExplainCtrl', [
    '$scope', '$element', '$log',
    function (
      $scope, $element, $log
    ) {
      var ctrl  = this;
      ctrl.query = $scope.query;

      function sortJsonByKeys(obj) {
        var sortedJsonKeys = Object.keys(obj).sort();
        var tempObj = {};
        sortedJsonKeys.map(function(key) { tempObj[key] = obj[key]; });
        return angular.toJson(tempObj, true);
      }

      // Feeds the query-explain Stimulus controller (query_explain.html's
      // mount div) — the sync parts of what was QueryExplainModalInstanceCtrl.
      // query.searcher stays Angular/splainer-search; this just serializes
      // what the Params/Parsing tabs need to render. The Query Template tab
      // needs a live network call (searcher.renderTemplate()) so it's bridged
      // via the query-explain:render-template/:template-rendered events below
      // instead of being included here.
      ctrl.queryExplainData = function() {
        var searcher = ctrl.query.searcher;
        // Not set until the query's first search() runs (queriesSvc.js) —
        // the toolbar can digest before that.
        if (!searcher) {
          return {
            parsedQueryDetails:  '{}',
            queryDetails:        null,
            queryDetailsMessage: 'No results yet.',
            supportsTemplate:    false,
          };
        }

        var data = {
          parsedQueryDetails:  sortJsonByKeys(searcher.parsedQueryDetails),
          queryDetails:        null,
          queryDetailsMessage: null,
          supportsTemplate:    angular.isDefined(searcher.isTemplateCall),
        };

        if (angular.isDefined(searcher.queryDetails)) {
          if (angular.equals(searcher.queryDetails, {})) {
            data.queryDetailsMessage = 'The list of query parameters used to construct the query was not returned by Solr.';
          }
          else {
            data.queryDetails = sortJsonByKeys(searcher.queryDetails);
          }
        }
        else {
          data.queryDetailsMessage = 'Query parameters are not returned by the current Search Engine.';
        }

        return data;
      };

      // Bridge for the Query Template tab (see comment above). Mirrors the
      // rating-popover bubbling-event pattern in searchResult.js.
      $element.on('query-explain:render-template', function(event) {
        event.stopPropagation();
        var searcher = ctrl.query.searcher;

        if (!searcher || !angular.isDefined(searcher.isTemplateCall)) {
          return;
        }

        var isTemplatedQuery = searcher.isTemplateCall(searcher.args);

        function dispatchResult(detail) {
          $element[0].dispatchEvent(new CustomEvent('query-explain:template-rendered', { detail: detail }));
        }

        searcher.renderTemplate().then(function() {
          dispatchResult({
            isTemplatedQuery:      isTemplatedQuery,
            renderedQueryTemplate: angular.toJson(searcher.renderedTemplateJson.template_output, true)
          });
        }, function(response) {
          $log.debug(response.data);
          dispatchResult({
            isTemplatedQuery: isTemplatedQuery,
            error:            true
          });
        });
      });

      $scope.$on('$destroy', function() {
        $element.off('query-explain:render-template');
      });
    }
  ]);
