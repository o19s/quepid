'use strict';

angular.module('QuepidApp')
  .component('qscoreCase', {
    controller:   'QscoreCaseCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'qscore_case/qscore_case.html',
    bindings:      {
      annotations:  '=',
      diffLabel:    '=',
      fullDiffName: '=',
      maxScore:     '=',
      scorable:     '=',
      scoreLabel:   '=',
      scores:       '=',
      showDiff:     '=',
    },
  });