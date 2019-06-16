'use strict';

angular.module('QuepidApp')
  .controller('DocExplainCtrl', [
    '$scope',
    'doc', 'maxScore',
    function DocExplainCtrl($scope, doc, maxScore) {
      // this controller is a bit silly just because
      // modals need their own controller
      $scope.doc = doc;
      $scope.maxScore = maxScore;
    }
  ]);
