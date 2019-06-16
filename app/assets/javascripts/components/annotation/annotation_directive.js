'use strict';

angular.module('QuepidApp')
  .component('annotation', {
    controller:   'AnnotationCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'annotation/annotation.html',
    bindings:     {
      theAnnotation: '='
    },
  });
