'use strict';
/*Style we used when we deceted a doc had a rating*/
angular.module('QuepidApp')
  .filter('thumbStyle', [
    function() {
      return function(doc) {
        if (doc.hasOwnProperty('thumb')) {
          return {'width': '300px',
                  'height': '200px',
                  'display': 'inline-block',
                  'overflow-y': 'auto',
                  'border-width': '1px',
                  'border-style': 'solid'};
        }
        else {
          return {};
        }
      };
    }
  ]);

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
        templateUrl: 'views/searchResult.html'
      };
    }
  ]);
