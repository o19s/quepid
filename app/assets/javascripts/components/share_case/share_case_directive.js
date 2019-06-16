'use strict';

angular.module('QuepidApp')
  .component('shareCase', {
    controller:   'ShareCaseCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'share_case/share_case.html',
    bindings:     {
      acase:    '<',
      iconOnly: '<',
    },
  });
