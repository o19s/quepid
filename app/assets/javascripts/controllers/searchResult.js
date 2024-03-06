'use strict';

angular.module('QuepidApp')
  .controller('SearchResultCtrl', [
    '$scope', '$uibModal',
    'rateElementSvc',
    function ($scope, $uibModal, rateElementSvc) {

      var src = {
        'query':  $scope.query,
        'doc':    $scope.doc,
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateElementSvc.setScale(src, $scope.ratings);
      });

      // Note, as of 29-Feb-24, the Highest Rated has been removed..  So...
      // You thought the scope is tied to the directive, and the directive
      // is tied to the DOM element, so the scope would follow it wherever
      // it went?
      // HA! You were wrong, terribly wrong!
      // If the user is viewing a comparison with the "Highest Rated" and
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
          extra.query.touchModifiedAt();
        },
        function(extra) {
          extra.doc.resetRating();
          extra.query.touchModifiedAt();
        },
        src
      );

      $scope.displayRating = function() {
        if (!$scope.doc.hasRating()) {
          return '--';
        }
        else {
          return $scope.doc.getRating();
        }
      };

      $scope.formatImageUrl = function(imgUrl, options) {
        if (options){
          if (options.prefix){
            imgUrl = options.prefix + imgUrl;
          }
        }
        return imgUrl;
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

      // Determine which style sheet to use to influence formatting
      $scope.summaryColumnStyle = function() {
        if ($scope.doc.hasThumb()){
          return 'col-summary-thumb';
        }
        else if ($scope.doc.hasImage()){
          return 'col-summary-image';
        }
        else {
          return '';
        }
      };
    }
  ]);
