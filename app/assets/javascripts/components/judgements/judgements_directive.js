'use strict';

angular.module('QuepidApp')
  .component('judgements', {
    controller:   'JudgementsCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'judgements/judgements.html',
    bindings:     {
      acase:    '<'
    },
  });
