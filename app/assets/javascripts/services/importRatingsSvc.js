'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('importRatingsSvc', [
    '$http',
    function importRatingsSvc(
      $http
    ) {
      var self = this;

      // Functions
      self.makeCall = makeCall;

      function makeCall(theCase, csv, clearQueries) {
        var url = '/api/import/ratings';

        var ratings = [];

        angular.forEach(csv, function(rating) {
          ratings.push({
            query_text: rating['Query Text'],
            doc_id:     rating['Doc ID'],
            rating:     rating['Rating'],
          });
        });

        var data = {
          ratings:        ratings,
          case_id:        theCase.caseNo,
          clear_queries:  clearQueries,
        };

        return $http.post(url, data);
      }
    }
  ]);
