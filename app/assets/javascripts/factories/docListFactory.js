'use strict';
/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('DocListFactory', ['normalDocsSvc', DocListFactory]);

  function DocListFactory(normalDocsSvc) {
    // altExplainJsonFor is an optional function(doc) -> explain JSON (or undefined), used to
    // feed a mapper-supplied explain breakdown (e.g. Vespa's matchfeatures, see
    // queriesSvc.js's matchFeaturesExplain) into the same {description, value, details} shape
    // Solr/ES explains use, when the search engine itself has no explain concept.
    var DocList = function(newDocs, fieldSpec, ratingsStore, altExplainJsonFor) {
      var self = this;

      self.list = docList;
      self.hasErrors = hasErrors;
      self.errorMsg = errorMsg;

      var docs = [];
      var error = '';

      buildDocList(newDocs, fieldSpec, ratingsStore);

      function buildDocList(newDocs, fieldSpec, ratingsStore) {
        var ids = [];
        var i = 0;

        angular.forEach(newDocs, function(doc) {
          var altExplainJson = altExplainJsonFor ? altExplainJsonFor(doc) : undefined;
          var normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, altExplainJson);
          var rateableDoc = ratingsStore.createRateableDoc(normalDoc);
          if (normalDoc.id === undefined || normalDoc.id === 'undefined') {
            error = 'Your selected id field <strong>' + fieldSpec.id + '</strong> is missing on one or more results.' +
                    ' Quepid requires a unique identifier for each document to work correctly. Open the <strong>Tune Relevance</strong> pane, ' +
                    ' and under <strong>Settings</strong> in the <strong>Displayed Fields</strong> field change <strong>id:' + fieldSpec.id + '</strong> to specify your unique ID field.';
            rateableDoc.error = 'ID Field Missing';
            rateableDoc.id = rateableDoc.error + i;

          }
          else if (ids.indexOf(normalDoc.id) >= 0) {
            error = 'Your selected id field <strong>' + fieldSpec.id + '</strong> doesn\'t uniquely identify individual documents.' +
                    ' Quepid requires a unique identifier for each document to work correctly. Open the <strong>Tune Relevance</strong> pane, ' +
                    ' and under <strong>Settings</strong> in the <strong>Displayed Fields</strong> field change <strong>id:' + fieldSpec.id + '</strong> to specify your unique ID field.';
            rateableDoc.error = 'ID <strong>' + normalDoc.id + '</strong> Shared With Another Doc';
            rateableDoc.id = rateableDoc.error + i;
            // should create a stub for this doc:
          }
          docs.push(rateableDoc);
          ids.push(normalDoc.id);
          i++;
        });
      }

      function docList() {
        return docs;
      }

      function hasErrors() {
        return errorMsg().length > 0;
      }

      function errorMsg() {
        return error;
      }
    };
    return DocList;
  }
})();
