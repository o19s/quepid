'use strict';

angular.module('QuepidApp')
  .controller('SearchResultCtrl', [
    '$scope', '$element', '$quepidModal',
    'rateElementSvc',
    function ($scope, $element, $quepidModal, rateElementSvc) {

      var src = {
        'query':  $scope.query,
        'doc':    $scope.doc,
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateElementSvc.setScale(src, $scope.ratings);
      });

      // Content and open/close state now live in the rating-popover Stimulus
      // controller (data-controller="rating-popover" in searchResult.html);
      // it dispatches these events on its own element, which bubble up to
      // whichever DOM node this controller is attached to. Stop propagation
      // so an ancestor's own rating-popover listener (e.g. SearchResultsCtrl's
      // "Score All" bulk rating) doesn't also fire for this single doc.
      $element.on('rating-popover:rate', function(event) {
        event.stopPropagation();
        var newRating = parseInt(event.detail.rating, 10);
        src.doc.rate(newRating);
        src.query.touchModifiedAt();
        $scope.$apply();
      });

      $element.on('rating-popover:reset', function(event) {
        event.stopPropagation();
        src.doc.resetRating();
        src.query.touchModifiedAt();
        $scope.$apply();
      });

      $scope.$on('$destroy', function() {
        $element.off('rating-popover:rate rating-popover:reset');
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
