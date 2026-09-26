'use strict';

// This service handles the giant blob of docs->ratingsyea
// sent down from the backend. It comes in when the query
// is initially retrieved and managed here.
//
// For documents whose id is a simple string, we pass that
// back and forth.  However, if the id of the document is
// a URL or contains a "." character, then we do escaping.
//
angular.module('QuepidApp')
  .service('ratingsStoreSvc', [
    '$rootScope',
    '$http',
    function ratingsStoreSvc($rootScope, $http) {
      var svcVersion = 0;

      this.createRatingsStore = function(caseNo, queryId, ratingsDict) {
        return new window.quepidSearch.ratings.RatingsStore({
          caseNo: caseNo,
          queryId: queryId,
          ratingsDict: ratingsDict,
          request: function(options) {
            return $http(options);
          },
          onChanged: function(changedQueryId) {
            svcVersion++;

            if (window.quepidStore && window.quepidStore.scoring) {
              window.quepidStore.scoring.markRatingChanged(changedQueryId);
            } else {
              // Compatibility for an Angular bundle loaded without the modern store.
              $rootScope.$emit('rating-changed', changedQueryId);
            }
          }
        });
      };

      this.version = function() {
        return svcVersion;
      };
    }
  ]);
