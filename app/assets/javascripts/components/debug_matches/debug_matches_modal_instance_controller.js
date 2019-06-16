'use strict';

angular.module('QuepidApp')
  .controller('DebugMatchesModalInstanceCtrl', [
    'doc', 'maxScore',
    function DocExplainCtrl(doc, maxScore) {
      var ctrl = this;

      // Attributes
      ctrl.doc      = doc;
      ctrl.maxScore = maxScore;
    }
  ]);
