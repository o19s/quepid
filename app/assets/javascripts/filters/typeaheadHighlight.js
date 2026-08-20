'use strict';

// Ported from angular-ui-bootstrap's `uibTypeaheadHighlight` (src/typeahead/typeahead.js).
// Wraps occurrences of `query` inside `matchItem` with <strong> for use in
// ng-bind-html dropdown row templates.
angular.module('QuepidApp')
  .filter('quepidTypeaheadHighlight', ['$sce', '$injector', '$log', function ($sce, $injector, $log) {
    const isSanitizePresent = $injector.has('$sanitize');

    function escapeRegexp(queryToEscape) {
      return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
    }

    function containsHtml(matchItem) {
      return /<.*>/g.test(matchItem);
    }

    return function (matchItem, query) {
      if (!isSanitizePresent && containsHtml(matchItem)) {
        $log.warn('Unsafe use of typeahead please use ngSanitize');
      }
      matchItem = query ?
        ('' + matchItem).replace(new RegExp(escapeRegexp(query), 'gi'), '<strong>$&</strong>') :
        matchItem;
      if (!isSanitizePresent) {
        matchItem = $sce.trustAsHtml(matchItem);
      }
      return matchItem;
    };
  }]);
