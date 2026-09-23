'use strict';

angular.module('QuepidApp')
  .controller('SearchResultCtrl', [
    '$scope', '$element',
    'rateScaleSvc', 'settingsSvc', 'caseTryNavSvc',
    function ($scope, $element, rateScaleSvc, settingsSvc, caseTryNavSvc) {

      var src = {
        'query':  $scope.query,
        'doc':    $scope.doc,
      };

      $scope.ratings = { };

      $scope.$watch('query.effectiveScorer()', function() {
        rateScaleSvc.setScale(src, $scope.ratings);
      });

      // Content and open/close state now live in the rating-popover Stimulus
      // controller (data-controller="rating-popover" in searchResult.html);
      // it dispatches these events on its own element, which bubble up to
      // whichever DOM node this controller is attached to. Stop propagation
      // so an ancestor's own rating-popover listener (e.g. SearchResultsCtrl's
      // "Score All" bulk rating) doesn't also fire for this single doc.
      $element.on('rating-popover:rate', function(event) {
        event.stopPropagation();
        var newRating = parseInt(event.originalEvent.detail.rating, 10);
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

      rateScaleSvc.setScale(src, $scope.ratings);

      $scope.displayRating = function() {
        if (!$scope.doc.hasRating()) {
          return '--';
        }
        else {
          return $scope.doc.getRating();
        }
      };

      // The modal is shared with the Stimulus results renderer through
      // window.quepidDom; this controller remains only for the Angular
      // Document Finder command path.
      $scope.showDoc = function() {
        var doc = $scope.doc;
        var url = doc._url();
        var linkUrl = url;
        if (linkUrl) {
          var credentials = settingsSvc.applicableSettings().basicAuthCredential;
          if (credentials) {
            linkUrl = linkUrl.replace('://', '://' + credentials + '@');
          }
          if (settingsSvc.applicableSettings().proxyRequests === true) {
            linkUrl = caseTryNavSvc.getQuepidProxyUrl(settingsSvc.applicableSettings().searchEndpointId) + linkUrl;
          }
        }

        window.quepidDom.detailedDocument.open({ doc: doc, linkUrl: linkUrl });
      };

      // Feeds the match-explain Stimulus controller (searchResult.html's
      // stacked-chart-container) — see docs/todo/angularjs_removal_inventory.md's
      // "DOM utilities" entry. doc.explain()/hotMatchesOutOf() stay Angular
      // (splainer-search); this just serializes what the popover/bars/debug
      // and expand modals need to render.
      var matchExplainCache = {
        doc: null,
        queryVersion: null,
        maxDocScore: null,
        data: null
      };

      $scope.matchExplainData = function() {
        var queryVersion = $scope.query.version();
        var maxDocScore = $scope.maxDocScore;
        if (matchExplainCache.doc === $scope.doc &&
            matchExplainCache.queryVersion === queryVersion &&
            matchExplainCache.maxDocScore === maxDocScore) {
          return matchExplainCache.data;
        }

        var explain      = $scope.doc.explain();
        var hasChildren  = explain.children.length > 0;

        matchExplainCache = {
          doc: $scope.doc,
          queryVersion: queryVersion,
          maxDocScore: maxDocScore,
          data: {
            hasChildren: hasChildren,
            hots: $scope.doc.hotMatchesOutOf(maxDocScore),
            explainToStr: hasChildren ? explain.toStr() : null,
            explainAsJson: hasChildren ? null : JSON.stringify(explain.asJson, null, 2),
            explainRawStr: explain.rawStr(),
            docTitle: $scope.doc.title,
            docId: $scope.doc.id,
            docScore: $scope.doc.score()
          }
        };
        return matchExplainCache.data;
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
