'use strict';

angular.module('QuepidApp')
  .component('importRatings', {
    controller:   'ImportRatingsCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'import_ratings/import_ratings.html',
    bindings:     {
      acase: '<',
    }
  });
