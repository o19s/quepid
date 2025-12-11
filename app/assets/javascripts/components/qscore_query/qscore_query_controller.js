'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreQueryCtrl', [
    '$scope', 'qscoreSvc',
    function ($scope, qscoreSvc) {
      var ctrl          = this;


      // Initialize controller properties
      ctrl.score        = 'b?b';
      ctrl.style        = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore) };
      
      // Watch for changes in the scorable's current score (deep watch for nested properties)
      $scope.$watch('ctrl.scorable.currentScore', function() {
        if (ctrl.scorable.currentScore) {
          var scorable = ctrl.scorable.currentScore;
          ctrl.score    = scorable.score;
          ctrl.maxScore = $scope.ctrl.maxScore;

          if ( angular.isDefined(scorable.backgroundColor) ) {
            ctrl.style = { 'background-color': scorable.backgroundColor };
          } else {
            ctrl.style = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore)};
          }          
        }
      }, true);
    }
  ]);