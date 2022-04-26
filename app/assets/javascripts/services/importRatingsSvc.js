'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('importRatingsSvc', [
    '$http',
    'configurationSvc',
    function importRatingsSvc(
      $http, cfg
    ) {
      var self = this;

      // Functions
      self.importCSVFormat = importCSVFormat;
      self.importRREFormat = importRREFormat;
      self.importLTRFormat = importLTRFormat;
      self.importInformationNeeds = importInformationNeeds;

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

        // The API only sees a hash of ratings.
        return $http.post(cfg.getApiPath() + 'import/ratings?file_format=hash', data);
      }

      function importRREFormat(theCase, rreJson, clearQueries) {

        var data = {
          rre_json:       rreJson,
          case_id:        theCase.caseNo,
          clear_queries:  clearQueries,
        };

        return $http.post(cfg.getApiPath() + 'import/ratings?file_format=rre', data);

      }

      function importLTRFormat(theCase, ltrText, clearQueries) {

        var data = {
          ltr_text:       ltrText,
          case_id:        theCase.caseNo,
          clear_queries:  clearQueries,
        };

        return $http.post(cfg.getApiPath() + 'import/ratings?file_format=ltr', data);

      }

      function importInformationNeeds(theCase, csv) {

        var data = {
          case_id:        theCase.caseNo,
          csv_text:       csv
        };

        // The API only sees a hash of ratings.
        return $http.post(cfg.getApiPath() + 'import/queries/information_needs', data);
      }

    }
  ]);
