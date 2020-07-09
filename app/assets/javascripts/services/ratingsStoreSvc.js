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
    '$http',
    function ratingsStoreSvc($http) {
      var svcVersion = 0;

      var RatingsStore = function(caseNo, queryId, ratingsDict) {
        var version   = 0;

        var basePath  = function() {
          return '/api/cases/' + caseNo + '/queries/' + queryId;
        };

        var path      = function(docId) {
          var id = docId;
          // For document id's that have either a / or a . character, we need to base64 encode them.
          // Rails pukes on the . and the webapp pukes on the / in routing things.
          if ( /\//.test(docId) || /\./.test(docId)) {
            id = btoa(docId);
          }

          return  basePath() + '/ratings/' + encodeURIComponent(id);
        };

        var markDirty = function() {
          version++;
          svcVersion++;
        };

        this.setQueryId = function(newQueryId) {
          queryId = newQueryId;
        };

        this.rateDocument = function(docId, rating) {
          $http.put(path(docId), {'rating': rating}).then(function() {
            ratingsDict[docId] = rating;
            markDirty();
          });
        };

        // We do not encode doc ids with the bulk because they are in the payload
        // instead of in the URL, so the / and . issues don't crop up.
        this.rateBulkDocuments = function(docIds, rating) {
          var url   = basePath() + '/bulk' + '/ratings';
          var data  = {
            doc_ids:  docIds,
            rating:   rating,
          };

          $http.put(url, data).then(function() {
            angular.forEach(docIds, function(docId){
              ratingsDict[docId] = rating;
            });

            markDirty();
          });
        };

        this.resetRating = function(docId) {
          $http.delete(path(docId)).then(function() {
            delete ratingsDict[docId];
            markDirty();
          });
        };

        this.resetBulkRatings = function(docIds) {
          var url   = basePath() + '/bulk' + '/ratings/delete';
          var data  = {
            doc_ids: docIds,
          };

          $http.post(url, data).then(function() {
            angular.forEach(docIds, function(docId){
              delete ratingsDict[docId];
            });

            markDirty();
          });
        };

        this.hasRating = function(docId) {
          return ratingsDict.hasOwnProperty(docId);
        };

        this.getRating = function(docId) {
          if (ratingsDict.hasOwnProperty(docId)) {
            var rating = ratingsDict[docId];
            if (angular.isString(rating)) {
              /* An annoying incosistency upstream is compensated for here:
               * sometimes we're given ratings as strings.
               * The backend bootstraps various features with ratings as strings
               * so we do a silly thing here and report the strings we store as ints
               * */
              rating = parseInt(rating, 10);
            }
            return rating;
          }
          else {
            return null;
          }
        };
        var ratingsStore = this;

        // to support dirty checking, this value increments on
        // every change to the ratings
        this.version = function() {
          return version;
        };

        // Retrieve the best documents based on rating
        // a list of ids sorted by rating
        this.bestDocs = function() {
          // take the object -> list of objects
          var ratingsArray = [];
          angular.forEach(ratingsDict, function(rating, docId) {
            ratingsArray.push({'id': docId, 'rating': parseInt(rating, 10)});
          });
          ratingsArray.sort(function(a, b) {return b.rating - a.rating;}); //descending order; null values are last; don't think returning null values is problematic but if it becomes we could filter them out here
          return ratingsArray;
        };

        // A Solr doc rateable for a this RatingStore's caseNo & queryId
        var RateableDoc = function() {
          this.rate = function(rating) {
            ratingsStore.rateDocument(this.id, rating);
          };

          this.rateBulk = function(ids, rating) {
            ratingsStore.rateBulkDocuments(ids, rating);
          };

          this.hasRating = function() {
            return ratingsStore.hasRating(this.id);
          };

          this.resetRating = function() {
            ratingsStore.resetRating(this.id);
          };

          this.resetBulkRatings = function(ids) {
            ratingsStore.resetBulkRatings(ids);
          };

          this.getRating = function() {
            return ratingsStore.getRating(this.id);
          };
        };

        this.createRateableDoc = function(normalDoc) {
          var rateableDoc = new RateableDoc();
          rateableDoc     = angular.merge(normalDoc, rateableDoc);
          return rateableDoc;
        };
      };


      this.createRatingsStore = function(caseNo, queryId, ratingsDict) {
        return new RatingsStore(caseNo, queryId, ratingsDict);
      };

      this.version = function() {
        return svcVersion;
      };
    }
  ]);
