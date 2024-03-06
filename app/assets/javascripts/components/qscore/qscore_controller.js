'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCtrl', [
    '$scope', 'qscoreSvc', 'queryViewSvc',
    function ($scope, qscoreSvc, queryViewSvc) {
      var ctrl          = this;
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      // Lots of cleanup/refactoring available
      ctrl.diffScore    = 'a?a';
      ctrl.diffStyle    = {};
      ctrl.score        = 'b?b';
      ctrl.scoreType    = ctrl.scoreType || 'normal';
      ctrl.style        = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore) };
      
      $scope.$watch('ctrl.scorable.currentScore', function() {
        if (ctrl.scorable.currentScore) {
          var scorable = ctrl.scorable.currentScore;
          ctrl.score    = scorable.score;
          ctrl.maxScore = $scope.ctrl.maxScore;

          //TODO refactor this
          if ( angular.isDefined(scorable.backgroundColor) ) {
            ctrl.style = { 'background-color': scorable.backgroundColor };
          } else {
            ctrl.style = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore)};
          }          
        }
      });
    
      //These watches updates the diffs in the main query list and the avgQuery
      $scope.$watch('ctrl.scorable.diff', function() {
        if (queryViewSvc.isDiffEnabled()){
          setDiff();  
        }   
      });
      
      // Primarily used to pick up when you change snapshots and update the diffs
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
          // 06-mar-24 this is probably able to be removed at some point.
          throw Error('PANIC.  We have a ctrl.diffScore that is null');
        }
        ctrl.diffInfo.score = ctrl.diffScore; //|| 'e?e';
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
