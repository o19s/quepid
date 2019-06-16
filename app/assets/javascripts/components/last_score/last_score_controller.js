'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('LastScoreCtrl', [
    '$scope',
    function ( $scope ) {
      var ctrl = this;
      ctrl.score = $scope.score;

      // Functions
      ctrl.scorePresent = scorePresent;

      function scorePresent() {
        return angular.isDefined(ctrl.score) && ctrl.score !== null;
      }
    }
  ]);
