'use strict';

angular.module('QuepidApp')
  .controller('QueryDiffResultsCtrl', [
    '$scope',
    function ($scope) {
      var returnValue = [];

      var howManyToDisplay = $scope.query.docs.length;
      if ( howManyToDisplay < 10 ) {
        howManyToDisplay = 10;
      }

      for(var j = 0; j < howManyToDisplay; j++) { //Initialize some doctuples
        returnValue[j] = { doc: null, diffDoc: null };
      }

      $scope.query.maxDiffDocScore = 0;

      $scope.query.docPairs = function() {
        var diffDocs = $scope.query.diff.docs();

        for(var i = 0 ; i < howManyToDisplay; i++) {
          if( $scope.query.docs[i] ) {
            returnValue[i].doc = $scope.query.docs[i];
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
