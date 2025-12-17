'use strict';

angular.module('QuepidApp')
  .controller('QueryDiffResultsCtrl', [
    '$scope',
    'queriesSvc',
    function ($scope, queriesSvc) {
      var returnValue = [];

      function docSource() {
        return queriesSvc.showOnlyRated ? $scope.query.ratedDocs : $scope.query.docs;
      }

      var howManyToDisplay = docSource().length;
      if (howManyToDisplay < 10) {
        howManyToDisplay = 10;
      }

      // Initialize doc tuples for multi-diff comparison
      for (var j = 0; j < howManyToDisplay; j++) {
        returnValue[j] = { 
          doc: null, 
          diffDocs: []  // Array to hold docs from multiple snapshots
        };
      }

      $scope.query.maxDiffDocScores = [];

      $scope.query.docTuples = function() {
        if (!$scope.query.diffs || !$scope.query.diffs.getSearchers) {
          return returnValue;
        }

        var allSearchers = $scope.query.diffs.getSearchers();
        
        // Initialize max scores array
        $scope.query.maxDiffDocScores = [];
        for (var s = 0; s < allSearchers.length; s++) {
          $scope.query.maxDiffDocScores[s] = 0;
        }

        for (var i = 0; i < howManyToDisplay; i++) {
          // Set current search result
          if (docSource()[i]) {
            returnValue[i].doc = docSource()[i];
          } else {
            returnValue[i].doc = null;
          }

          // Set diff docs from all searchers
          returnValue[i].diffDocs = [];
          
          for (var searcherIndex = 0; searcherIndex < allSearchers.length; searcherIndex++) {
            var diffDocs = $scope.query.diffs.docs(searcherIndex, queriesSvc.showOnlyRated);
            
            if (diffDocs[i]) {
              var diffDoc = diffDocs[i];
              $scope.query.maxDiffDocScores[searcherIndex] = Math.max(
                $scope.query.maxDiffDocScores[searcherIndex], 
                diffDoc.score()
              );
              returnValue[i].diffDocs[searcherIndex] = diffDoc;
            } else {
              returnValue[i].diffDocs[searcherIndex] = null;
            }
          }
        }
        
        return returnValue;
      };



      // Utility function to detect differences between results
      $scope.getResultDifference = function(currentDoc, diffDoc) {
        if (!currentDoc && !diffDoc) {
          return 'same';
        }
        if (!currentDoc && diffDoc) {
          return 'missing-current';
        }
        if (currentDoc && !diffDoc) {
          return 'missing-snapshot';
        }
        if (currentDoc.id === diffDoc.id) {
          return 'same';
        }
        return 'different';
      };

      // Add CSS classes based on differences
      $scope.getResultClass = function(difference) {
        switch (difference) {
          case 'different':
            return 'different';
          case 'missing-current':
            return 'missing';
          case 'missing-snapshot':
            return 'new';
          default:
            return '';
        }
      };
    }
  ]);