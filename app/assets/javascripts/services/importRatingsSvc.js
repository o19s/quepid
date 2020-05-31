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
      self.importCSVFormat = importCSVFormat;
      self.importRREFormat = importRREFormat;

      function importCSVFormat(theCase, csv, clearQueries) {
        var ratings = [];

        angular.forEach(csv, function(rating) {
          ratings.push({
            query_text: rating['query'],
            doc_id:     rating['docid'],
            rating:     rating['rating'],
          });
        });

        var data = {
          ratings:        ratings,
          case_id:        theCase.caseNo,
          clear_queries:  clearQueries,
        };

        return $http.post('/api/import/ratings', data);
      }

      function importRREFormat(theCase, rreJson, clearQueries) {

        var data = {
          rre_json:       rreJson,
          case_id:        theCase.caseNo,
          clear_queries:  clearQueries,
        };

        return $http.post('/api/import/ratings?file_format=rre', data);

      }
    }
  ]);
