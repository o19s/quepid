'use strict';

angular.module('QuepidApp')
  .controller('SearchResultCtrl', [
    '$scope', '$uibModal',
    'queriesSvc',
    'rateElementSvc',
    function ($scope, $uibModal, queriesSvc, rateElementSvc) {

      var src = {
        'query':  $scope.query,
        'doc':    $scope.doc,
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateElementSvc.setScale(src, $scope.ratings);
      });

      // You thought the scope is tied to the directive, and the directive
      // is tied to the DOM element, so the scope would follow it wherever
      // it went?
      // HA! You were wrong, terribly wrong!
      // If the user is viewing a comparison with the "Higest Rated" and
      // changes the ratings such that the order of the docs changes, well...
      // how to put it? Everything goes kaput!
      // And all of the sudden the user thinks he's rating doc i_123 when in
      // fact it's doc i_456.... mwahahaha!
      // Or, we could just refresh the "doc"...
      $scope.$watch('doc', function() {
        src.doc = $scope.doc;
      });

      rateElementSvc.setScale(src, $scope.ratings);
      rateElementSvc.handleRatingScale($scope.ratings,
        function(ratingNo, extra) {
          var newRating = parseInt(ratingNo, 10);
          extra.doc.rate(newRating);
        },
        function(extra) {
          extra.doc.resetRating();
        },
        src
      );

      $scope.displayRating = function() {
        if (!$scope.doc.hasRating()) {
          return '-';
        }
        else {
          return $scope.doc.getRating();
        }
      };

      $scope.snippets = $scope.doc.subSnippets('<strong>', '</strong>');

      $scope.showDoc = function() {
        $uibModal.open({
          templateUrl: 'views/detailedDoc.html',
          controller: 'DetailedDocCtrl',
          resolve: {
            doc: function() {
              return $scope.doc;
            }
          }
        });
      };

      $scope.showDetailed = function() {
        console.log('ive been pressed');
        $uibModal.open({
          templateUrl: 'views/detailedExplain.html',
          controller: 'DocExplainCtrl',
          //windowClass: 'detailed-explain-modal',
          resolve: {
            doc: function() {
              return $scope.doc;
            },
            maxScore: function() {
              return $scope.maxDocScore;
            }
          }
        });
      };

      $scope.isObjectOrArray = function(value) {
        return typeof value === 'object';
      };
      $scope.isUrl = function(value) {
        return ( /^\s*http[s]?:.*/.test(value));
      };
    }
  ]);
