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
      
      // Watch for changes in the scorable's current score (original behavior - performance optimized)
      $scope.$watch('ctrl.scorable.currentScore', function() {
        if (ctrl.scorable && ctrl.scorable.currentScore) {
          updateScore();
        }
      }, true);

      // Watch for changes in searcher's diff score (for multi-diff support)  
      $scope.$watch('ctrl.scorable.diffScore', function() {
        if (ctrl.scorable && ctrl.scorable.diffScore) {
          updateScore();
        }
      }, true);

      // Watch for maxScore changes to update colors
      $scope.$watch('ctrl.maxScore', function() {
        updateScore();
      });

      // Initialize score on load
      updateScore();
      
      // Diff functionality has been moved to separate components
      // This component now handles only single score display
    }
  ]);
