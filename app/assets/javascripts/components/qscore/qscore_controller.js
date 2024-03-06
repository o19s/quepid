'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCtrl', [
    '$scope', 'qscoreSvc', 'queryViewSvc',
    function ($scope, qscoreSvc, queryViewSvc) {
      var ctrl          = this;
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      ctrl.diffScore    = 'a?a';
      ctrl.diffStyle    = {};
      ctrl.score        = 'b?b';
      ctrl.scoreType    = ctrl.scoreType || 'normal';
      ctrl.style        = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore) };

      $scope.$watch('ctrl.fullDiffName', function(newVal, oldVal) {
        console.log("fullDiffName")
        if (newVal !== oldVal) {
          ctrl.which = 'snapshot';
        }
      });
      
      $scope.$watch('ctrl.scorable.currentScore', function() {
        if (ctrl.scorable.currentScore) {
          console.log("We have for scoreType " + ctrl.scoreType + ", a watch change on ctrl.scorable.currentScore");
          console.log("The ctrl.scorable.currentScore is ")
          console.log(ctrl.scorable.currentScore)
          
          console.log("The ctrl.scorable is ")
          console.log(ctrl.scorable)
          var scorable = ctrl.scorable.currentScore;
          console.log("the " + ctrl.scoreType + " scorable score is " + scorable.score);
          ctrl.score    = scorable.score;
          ctrl.maxScore = $scope.ctrl.maxScore;

          //TODO refactor this
          if ( angular.isDefined(scorable.backgroundColor) ) {
            ctrl.style = { 'background-color': scorable.backgroundColor };
          } else {
            ctrl.style = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore)};
          }
          
          if (queryViewSvc.isDiffEnabled()){
            //setDiff();  
            //ctrl.scorable.diff.score().then( (diffScore) => {
            //  console.log(ctrl.scoreType + ": Just finished running .diff.score().  Here is the diffScore")
            //  console.log(diffScore);
            //})
          }
        }
      });

      
      // $scope.$watchGroup(['ctrl.scorable.diff', 'ctrl.diffLabel'], () => {
      //   if (queryViewSvc.isDiffEnabled()){
      //     setDiff();  
      //   }        
      // });
      

      //These watches updates the diffs in the main query list and the avgQuery
      $scope.$watch('ctrl.scorable.diff', function() {
        if (queryViewSvc.isDiffEnabled()){
          console.log("watch on ctrl.scorable.diff, calling setDiff")
          console.log("The ctrl.scorable.diff is ")
          console.log(ctrl.scorable.diff)
          setDiff();  
        }   
        else {
          console.log("MAYBE SHOULD RESET DIFF STUFF?")
        }
      });
      
      $scope.$watch('ctrl.fullDiffName', function() {
        if (queryViewSvc.isDiffEnabled()){
          console.log("watch on ctrl.fullDiffName, calling setDiff")
          console.log("The ctrl.fullDiffName is ")
          console.log(ctrl.fullDiffName)
          setDiff();  
        }   
        else {
          console.log("MAYBE SHOULD RESET DIFF STUFF?222")
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
        if (ctrl.diffScore == null){
          console.error("PANIC.  We have a ctrl.diffScore that is null")
        }
        ctrl.diffInfo.score = ctrl.diffScore //|| 'e?e';
        ctrl.diffInfo.style = ctrl.diffStyle;
      }

      function setDiff() {
        if (ctrl.scorable.diff !== null) {
          console.log(ctrl.scoreType +": in setDiff with diff enabled, about to score diff.")
          ctrl.scorable.diff.score().then( (diffScore) => {
            
            console.log("in setDiff")
            console.log(diffScore)
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
