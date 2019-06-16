'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('AnnotationCtrl', [
    '$uibModal',
    'flash',
    'annotationsSvc',
    function($uibModal, flash, annotationsSvc) {
      var ctrl = this;

      // Functions
      ctrl.delete = deleteAnnotation;
      ctrl.update = updateAnnotation;

      function deleteAnnotation () {
        annotationsSvc.delete(ctrl.theAnnotation)
          .then(function() {
            flash.success = 'Annotation deleted successfully!';
          }, function() {
            flash.error = 'Unable to delete Annotation.';
          });
      }

      function updateAnnotation () {
        var temp = angular.copy(ctrl.theAnnotation);

        var modalInstance = $uibModal.open({
          templateUrl:  'annotation/_update.html',
          controller:   'EditAnnotationModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve : {
            annotation: function() {
              return ctrl.theAnnotation;
            }
          }
        });

        modalInstance.result.then(
          function(annotation) {
            annotationsSvc.update(annotation)
              .then(function() {
                flash.success = 'Annotation updated successfully!';
              },
              function(response) {
                console.log('response: ', response);
                flash.error = response.data.message;
              });
          },
          function() {
            ctrl.theAnnotation = temp;
          }
        );
      }
    }
  ]);
