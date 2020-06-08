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
      ctrl.style        = qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore);

      $scope.$watch('ctrl.scorable.score()', function() {
        var scorable = ctrl.scorable.score();

        ctrl.score    = scorable.score;
        ctrl.maxScore = $scope.ctrl.maxScore;

        if ( angular.isDefined(scorable.backgroundColor) ) {
          ctrl.style = { 'background-color': scorable.backgroundColor };
        } else {
          ctrl.style = { 'background-color': qscoreSvc.scoreToColor(ctrl.score, ctrl.maxScore)};
        }

        setDiff();
      });

      // Functions
      ctrl.getDiffInfo = getDiffInfo;

      // WARNING: DO NOT REMOVE THIS FUNCTION!
      // AngularJS automatically updates the DOM when the return value
      // of a function changes.
      // So calling `setDiff()` in this function will update the
      // return value of the function any time there are changes, which
      // in turn update the DOM.
      function getDiffInfo() {
        setDiff();
        return {
          label: ctrl.diffLabel,
          score: ctrl.diffScore || '?',
          style: ctrl.diffStyle,
        };
      }

      function setDiff() {
        if (ctrl.scorable.diff !== null) {
          var diffScore = angular.copy(ctrl.scorable.diff.score());

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
        } else {
          setDefaultDiff();
        }
      }

      function setDefaultDiff() {
        ctrl.diffScore  = '?';
        ctrl.diffStyle  = defaultStyle;
      }
    }
  ]);
