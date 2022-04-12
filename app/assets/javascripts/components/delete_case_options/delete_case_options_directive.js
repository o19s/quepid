'use strict';

angular.module('QuepidApp')
  .component('deleteCaseOptions', {
    controller:   'DeleteCaseOptionsCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'delete_case_options/delete_case_options.html',
    bindings:     {
      acase: '<',
    }
   });
