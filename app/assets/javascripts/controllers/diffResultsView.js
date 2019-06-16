'use strict';

// Responsible for picking a second set of
// queryDocs to show next to the current search results
// for a given query
angular.module('QuepidApp')
  .controller('DiffResultsCtrl', [
    '$scope',
    function ($scope) {
      $scope.diffEnbl = true;
    }
  ]);
