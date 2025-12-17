'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCaseCtrl', [
    '$scope', 'qscoreSvc',
    function ($scope, qscoreSvc) {
      var ctrl          = this;

      // Initialize controller properties
      ctrl.score        = '?';
      ctrl.style        = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore) };
      
      // Helper function to get score from different types of scorable objects
      function getScoreFromScorable(scorable) {
        // Handle query objects with currentScore (existing behavior)
        if (scorable && scorable.currentScore) {
          return {
            score: scorable.currentScore.score,
            backgroundColor: scorable.currentScore.backgroundColor
          };
        }
        
        // Handle searcher objects with diffScore (for multi-diff support)
        if (scorable && scorable.diffScore) {
          return {
            score: scorable.diffScore.score,
            backgroundColor: scorable.diffScore.backgroundColor
          };
        }
        
        // Handle direct score objects (fallback)
        if (scorable && angular.isDefined(scorable.score)) {
          return {
            score: scorable.score,
            backgroundColor: scorable.backgroundColor
          };
        }
        
        return null;
      }
      
      // Update score display
      function updateScore() {
        if (ctrl.scorable) {
          var scoreData = getScoreFromScorable(ctrl.scorable);
          
          if (scoreData && scoreData.score !== null && scoreData.score !== undefined) {
            ctrl.score = scoreData.score;

            if (angular.isDefined(scoreData.backgroundColor)) {
              ctrl.style = { 'background-color': scoreData.backgroundColor };
            } else {
              ctrl.style = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore)};
            }
          }
        }
      }
      
      // Watch for changes in specific score properties instead of deep watching entire objects
      // This improves performance by only watching the properties we actually use
      $scope.$watchGroup([
        function() { return ctrl.scorable && ctrl.scorable.currentScore && ctrl.scorable.currentScore.score; },
        function() { return ctrl.scorable && ctrl.scorable.currentScore && ctrl.scorable.currentScore.backgroundColor; },
        function() { return ctrl.scorable && ctrl.scorable.diffScore && ctrl.scorable.diffScore.score; },
        function() { return ctrl.scorable && ctrl.scorable.diffScore && ctrl.scorable.diffScore.backgroundColor; },
        function() { return ctrl.maxScore; }
      ], function() {
        updateScore();
      });

      // Initialize score on load
      updateScore();
      
      // Diff functionality has been moved to separate components
      // This component now handles only single score display
    }
  ]);
