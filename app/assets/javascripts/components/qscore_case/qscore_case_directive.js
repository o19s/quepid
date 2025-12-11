'use strict';

angular.module('QuepidApp')
  .component('qscoreCase', {
    controller:   'QscoreCaseCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'qscore_case/qscore_case.html',
    bindings:      {
      annotations:  '=',
      maxScore:     '=',
      scorable:     '=',
      scoreLabel:   '=',
      scores:       '=',
    },
  });