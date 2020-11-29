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
      if ( howManyToDisplay < 10 ) {
        howManyToDisplay = 10;
      }

      for(var j = 0; j < howManyToDisplay; j++) { //Initialize some doctuples
        returnValue[j] = { doc: null, diffDoc: null };
      }

      $scope.query.maxDiffDocScore = 0;

      $scope.query.docPairs = function() {
        var diffDocs = $scope.query.diff.docs(queriesSvc.showOnlyRated);

        for(var i = 0 ; i < howManyToDisplay; i++) {
          if( docSource()[i] ) {
            returnValue[i].doc = docSource()[i];
          } else {
            returnValue[i].doc = null;  // To overwrite old docs
                                        // (ie when switching from snapshot
                                        // to highest rated
          }

          if( diffDocs[i] ) {
            var diffDoc = diffDocs[i];
            $scope.query.maxDiffDocScore = Math.max($scope.query.maxDiffDocScore, diffDoc.score());
            returnValue[i].diffDoc = diffDoc;
          } else {
            returnValue[i].diffDoc = null;
          }
        }
        return returnValue;
      };
    }
  ]);
