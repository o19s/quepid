'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .service('annotationsSvc', [
    '$http',
    'broadcastSvc',
    'AnnotationFactory',
    function annotationsSvc($http, broadcastSvc, AnnotationFactory) {
      var self    = this;
      var baseURL = 'api/cases/';

      var annotationsUrl = function(caseId) {
        return baseURL + caseId + '/annotations';
      };

      // Functions
      self.create   = create;
      self.delete   = deleteAnnotation;
      self.fetchAll = fetchAll;
      self.update   = update;

      function create (caseId, data) {
        var url = annotationsUrl(caseId);

        return $http.post(url, data)
          .then(function (response) {
            broadcastSvc.send('updatedCaseScore', { caseNo: caseId });
            return new AnnotationFactory(response.data);
          });
      }

      function deleteAnnotation (annotation) {
        var url = annotationsUrl(annotation.caseId) + '/' + annotation.id;

        return $http.delete(url)
          .then(function() {
            broadcastSvc.send('updatedCaseScore', { caseNo: annotation.caseId });
            broadcastSvc.send('annotationDeleted', annotation);
          });
      }

      function fetchAll (caseId) {
        var url = annotationsUrl(caseId);

        return $http.get(url)
          .then(function(response) {
            var annotationsList = [];

            angular.forEach(response.data.annotations, function(annotationJSON) {
              annotationsList.push(new AnnotationFactory(annotationJSON));
            });

            return annotationsList;
          });
      }

      function update (annotation) {
        var url = annotationsUrl(annotation.caseId) + '/' + annotation.id;

        var data = {
          annotation: {
            message:  annotation.message,
            source:   annotation.source,
          }
        };

        return $http.put(url, data)
          .then(function(response) {
            broadcastSvc.send('updatedCaseScore', { caseNo: annotation.caseId });
            annotation = new AnnotationFactory(response.data);
            return annotation;
          });
      }
    }
  ]);
