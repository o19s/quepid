'use strict';

angular.module('QuepidApp')
  .component('populateJudgements', {
    controller:   'PopulateJudgementsCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'populate_judgements/populate_judgements.html',
    bindings:     {
      acase:    '<'
    },
  });
