'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('AnnotationFactory', [
      AnnotationFactory
    ]);

  function AnnotationFactory() {
    var Annotation = function (data) {
      var self = this;

      // Attributes
      self.caseId     = data.score.case_id;
      self.createdAt  = data.created_at;
      self.updatedAt  = data.updated_at;
      self.id         = data.id;
      self.message    = data.message;
      self.score      = data.score;
      self.source     = data.source;
      self.user       = data.user;
    };

    return Annotation;
  }
})();
