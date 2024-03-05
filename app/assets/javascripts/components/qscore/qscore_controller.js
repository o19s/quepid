'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCtrl', [
    '$scope', 'qscoreSvc', 'queryViewSvc',
    function ($scope, qscoreSvc, queryViewSvc) {
      var ctrl          = this;
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      //console.log("qscore_controller:" + ctrl.scoreType + " About to set ctrlDiffscore and ctrl.Score to ?4?");
      //ctrl.diffScore    = '?4?';
      //ctrl.diffStyle    = {};
      //ctrl.score        = '?5?';
      //ctrl.scoreType    = ctrl.scoreType || 'normal';
      //ctrl.style        = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore) };

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
          
          if (queryViewSvc.isDiffEnabled()){
            console.log("qscore_controller:" + ctrl.scoreType + " the watch on ctrl.scorable.currentScore was called and diff enabled, so doing setDiff")
            setDiff();  
          }     
        }
      });

      // This watch appears to be focused on the Diff level query level QScore
      // This watch appears to be focused on the Diff level scoquery level QScore
      $scope.$watch('ctrl.scorable.diff', function() {
        console.log("qscore_controller:" + ctrl.scoreType + " This watch on 'ctrl.scorable.diff' just triggeredd...")
        console.log("and isDiffEnabled?" + queryViewSvc.isDiffEnabled());
          if (queryViewSvc.isDiffEnabled()){
            setDiff();  
          }  
      });
      
      // This watch is what triggers the case level Diff QScore to render.
      $scope.$watch('ctrl.diffLabel', function() {
        console.log("qscore_controller:" + ctrl.scoreType + " This watch on 'ctrl.diffLabel' just triggeredd...")
        console.log(ctrl);
        console.log("and isDiffEnabled?" + queryViewSvc.isDiffEnabled());
          if (queryViewSvc.isDiffEnabled()){
            setDiff();  
          }  
      });      
    

      console.log("qscore_controller:" + ctrl.scoreType + " Line 39, and ctrl.score is " + ctrl.score + " and ctrl.diffScore is " + (ctrl.diffScore ));
      //ctrl.diffInfo = {
      //  label: ctrl.diffLabel,
      //  score: ctrl.diffScore || '?3?',
      //  style: ctrl.diffStyle,
      //};

      // Functions
      // function updateDiffInfo() {
      //   console.log("qscore_controller:" + ctrl.scoreType + " in updateDiffInfo")
      //   console.log(ctrl)
      //   //ctrl.diffLabel = ctrl.diffLabel;        
      //   console.log("Line 48, and ctrl.diffScore is " + (ctrl.diffScore || '?2?'));
      //   // it appears that i our logic below, if diffScore is 0, then we set it to '?2?'
      //   // I suspect the logic was that if ctrl.diffScore was NULL then we put in ?2?        
      //   //ctrl.diffInfo.score = ctrl.diffScore || '?2?';
      //   //ctrl.diffInfo.score = ctrl.diffScore
      //   //ctrl.diffScore = 0.6
      //   //ctrl.diffInfo.diffScore = 0.8
      //   //ctrl.diffInfo.style = ctrl.diffStyle;
      // }

      function setDiff() {
        if (ctrl.scorable.diff !== null) {
          ctrl.scorable.diff.score().then( (diffScore) => {
            if (diffScore.score === null) {
              //setDefaultDiff();
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

            
          });


        } else {
          ctrl.diffScore  = '?1?';
          ctrl.diffStyle  = defaultStyle;
          //setDefaultDiff();
        }
        //updateDiffInfo();
      }

      //function setDefaultDiff() {
        //
        //updateDiffInfo();
        //}
    }
  ]);
