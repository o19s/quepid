'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCtrl', [
    '$scope', 'qscoreSvc',
    function ($scope, qscoreSvc) {
      var ctrl          = this;
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      ctrl.diffScore    = '?';
      ctrl.diffStyle    = {};
      ctrl.score        = '?';
      ctrl.scoreType    = ctrl.scoreType || 'normal';
      ctrl.style        = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore) };

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
      });

      // This watch updates the diffs in the main query list and the avgQuery
      $scope.$watchGroup(['ctrl.scorable.diff', 'ctrl.diffLabel'], () => {
        setDiff();
      });

      ctrl.diffInfo = {
        label: ctrl.diffLabel,
        score: ctrl.diffScore || '?',
        style: ctrl.diffStyle,
      };

      // Functions
      function updateDiffInfo() {
        ctrl.diffInfo.label = ctrl.diffLabel;
        ctrl.diffInfo.score = ctrl.diffScore || '?';
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
        ctrl.diffScore  = '?';
        ctrl.diffStyle  = defaultStyle;
        updateDiffInfo();
      }
    }
  ]);
