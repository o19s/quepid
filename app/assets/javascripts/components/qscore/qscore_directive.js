'use strict';

angular.module('QuepidApp')
  .component('qscore', {
    controller:   'QscoreCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'qscore/qscore.html',
    bindings:      {
      annotations:  '=',
      diffLabel:    '=',
      fullDiffName: '=',
      maxScore:     '=',
      scorable:     '=',
      scoreLabel:   '=',
      scores:       '=',
      scoreType:    '=',
      showDiff:     '=',
    },
  });
