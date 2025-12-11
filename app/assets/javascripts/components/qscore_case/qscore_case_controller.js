'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCaseCtrl', [
    '$scope', 'qscoreSvc', 'queryViewSvc',
    function ($scope, qscoreSvc, queryViewSvc) {
      var ctrl          = this;
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      // Initialize controller properties
      ctrl.diffScore    = 'a?a';
      ctrl.diffStyle    = {};
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
    
      // Watch for diff changes in the main query list and avgQuery
      $scope.$watch('ctrl.scorable.diff', function() {
        if (queryViewSvc.isDiffEnabled()){
          setDiff();  
        }   
      });
      
      // Watch for snapshot changes to update diffs
      $scope.$watch('ctrl.fullDiffName', function() {
        if (queryViewSvc.isDiffEnabled()){
          setDiff();  
        }   
      });      

      ctrl.diffInfo = {
        label: ctrl.diffLabel,
        score: ctrl.diffScore || 'd?d',
        style: ctrl.diffStyle,
      };

      // Functions
      function updateDiffInfo() {
        ctrl.diffInfo.label = ctrl.diffLabel;
        if (ctrl.diffScore == null) {
          throw Error('PANIC.  We have a ctrl.diffScore that is null');
        }
        ctrl.diffInfo.score = ctrl.diffScore;
        ctrl.diffInfo.style = ctrl.diffStyle;
      }

      function setDiff() {
        if (ctrl.scorable.diff !== null) {
          ctrl.scorable.diff.score().then( (diffScore) => {
            
            if (diffScore.score === null) {
              setDefaultDiff();
              return;
            }

            ctrl.diffScore = diffScore.score;

            if (  angular.isDefined(diffScore.backgroundColor) &&
                  diffScore.backgroundColor !== null
            ) {
              ctrl.diffStyle = { 'background-color': diffScore.backgroundColor };
            } else {
              ctrl.diffStyle = { 'background-color': qscoreSvc.scoreToColor(diffScore.score, ctrl.maxScore)};
            }

            updateDiffInfo();
          });

        } else {
          setDefaultDiff();
        }
      }

      function setDefaultDiff() {
        ctrl.diffScore  = 'c?c';
        ctrl.diffStyle  = defaultStyle;
        updateDiffInfo();
      }
    }
  ]);