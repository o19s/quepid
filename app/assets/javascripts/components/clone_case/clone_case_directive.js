'use strict';

angular.module('QuepidApp')
  .component('cloneCase', {
    controller:   'CloneCaseCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'clone_case/clone_case.html',
    bindings:     {
      acase: '<',
    }
   });
