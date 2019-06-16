'use strict';

angular.module('QuepidApp')
  .component('debugMatches', {
    controller:   'DebugMatchesCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'debug_matches/debug_matches.html',
    bindings:        {
      doc:         '=',
      maxDocScore: '=',
    },
  });
