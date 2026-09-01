'use strict';

angular.module('QuepidApp')
  .controller('SearchResultCtrl', [
    '$scope', '$quepidModal',
    'rateElementSvc',
    function ($scope, $quepidModal, rateElementSvc) {

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
        $quepidModal.open({
          templateUrl: 'views/detailedDoc.html',
          controller: 'DetailedDocCtrl',
          size: 'lg',
          resolve: {
            doc: function() {
              return $scope.doc;
            }
          }
        });
      };

      $scope.showDetailed = function() {
        $quepidModal.open({
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

      // fieldName may be a field_spec dotted path (e.g. "fields.url"), which isn't a
      // literal key on the raw doc. Mirrors the dotted-path traversal splainer-search's
      // normalDocsSvc already uses to populate fieldValue, so links use the un-escaped
      // original value instead of the (possibly HTML-escaped/truncated) snippet.
      $scope.resolveFieldValue = function(fieldName) {
        var raw = $scope.doc.doc.origin();
        if (Object.prototype.hasOwnProperty.call(raw, fieldName)) {
          return raw[fieldName];
        }
        return fieldName.split('.').reduce(function(acc, key) {
          return (acc && typeof acc === 'object') ? acc[key] : undefined;
        }, raw);
      };

    }
  ]);
