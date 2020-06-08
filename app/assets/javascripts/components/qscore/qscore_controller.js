'use strict';
/* jshint latedef: false */

angular.module('QuepidApp')
  .controller('QscoreCtrl', [
    '$scope',
    function ($scope) {
      var ctrl          = this;
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      ctrl.diffScore    = '?';
      ctrl.diffStyle    = {};
      ctrl.score        = '?';
      ctrl.scoreType    = ctrl.scoreType || 'normal';
      ctrl.style        = scoreToColor(ctrl.score);

      $scope.$watch('ctrl.scorable.score()', function() {
        var scorable = ctrl.scorable.score();

        ctrl.score    = scorable.score;
        ctrl.maxScore = $scope.ctrl.maxScore;

        if ( angular.isDefined(scorable.backgroundColor) ) {
          ctrl.style = { 'backgroundColor': scorable.backgroundColor };
        } else {
          ctrl.style = scoreToColor(ctrl.score);
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
            ctrl.diffStyle = scoreToColor(diffScore.score);
          }
        } else {
          setDefaultDiff();
        }
      }

      function setDefaultDiff() {
        ctrl.diffScore  = '?';
        ctrl.diffStyle  = defaultStyle;
      }

      function scoreToColor(score) {
        // TODO add support for diff width
        if ( score === '?' ) {
          return defaultStyle;
        }

        if ( score === null ) {
          return defaultStyle;
        }

        // Make the color of the score relative to the max score possible:
        score = score * 100 / ctrl.maxScore;
        score = Math.round(parseInt(score, 10) / 10);
        return {
          '-1': { 'background-color': 'hsl(0, 100%, 40%)'},
          '0':  { 'background-color': 'hsl(5, 95%, 45%)'},
          '1':  { 'background-color': 'hsl(10, 90%, 50%)'},
          '2':  { 'background-color': 'hsl(15, 85%, 55%)'},
          '3':  { 'background-color': 'hsl(20, 80%, 60%)'},
          '4':  { 'background-color': 'hsl(24, 75%, 65%)'},
          '5':  { 'background-color': 'hsl(28, 65%, 75%)'},
          '6':  { 'background-color': 'hsl(60, 55%, 65%)'},
          '7':  { 'background-color': 'hsl(70, 70%, 50%)'},
          '8':  { 'background-color': 'hsl(80, 80%, 45%)'},
          '9':  { 'background-color': 'hsl(90, 85%, 40%)'},
          '10': { 'background-color': 'hsl(100, 90%, 35%)'}
        }[score];
      }
    }
  ]);
