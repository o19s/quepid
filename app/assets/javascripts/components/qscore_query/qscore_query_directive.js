'use strict';

angular.module('QuepidApp')
  .component('qscoreQuery', {
    controller:   'QscoreQueryCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'qscore_query/qscore_query.html',
    bindings:      {
      maxScore:     '=',
      scorable:     '=',
    },
  });