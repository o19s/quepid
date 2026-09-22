'use strict';
angular.module('QuepidApp')
  .directive('searchResult', [
    function () {
      return {
        restrict: 'E',
        scope: {
          doc: '=', /*document being displayed*/
          fieldSpec: '=',
          maxDocScore: '=',
          explainView: '=',
          explainViewport: '=',
          query: '=',
          docId: '=',
          rank: '@'
        },
        controller: 'SearchResultCtrl',
        template: '<div data-search-result-target="content"></div>',
        link: function(scope, element) {
          element.attr('data-controller', 'search-result');
          element.attr('data-search-result-explain-view-value', scope.explainView || '');
        }
      };
    }
  ]);
