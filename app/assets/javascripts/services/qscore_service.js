'use strict';

angular.module('QuepidApp')
  .service('qscoreSvc', [
    function () {
      var defaultStyle  = { 'background-color': 'hsl(0, 0%, 0%, 0.5)'};

      this.scoreToColor = function(score, maxScore) {
        // obviously debugging!
        if ( score === '?' || score === null) {
          return defaultStyle;
        }

        // Gray for queries with pending ratings
        if ( score === '--') {
          return 'hsl(0, 0%, 91%)';
        }
        
        // Gray for zsr with pending ratings
        if ( score === 'zsr') {
          return 'hsl(0, 0%, 91%)';
        }

        // Make the color of the score relative to the max score possible:
        score = Math.min(score, maxScore); // This is needed in case a user switches to a binary scorer from a nonbinary
        score = score * 100 / maxScore;
        score = Math.round(parseInt(score, 10) / 10);
        return {
          '-1': 'hsl(0, 100%, 40%)',
          '0':  'hsl(5, 95%, 45%)',
          '1':  'hsl(10, 90%, 50%)',
          '2':  'hsl(15, 85%, 55%)',
          '3':  'hsl(20, 80%, 60%)',
          '4':  'hsl(24, 75%, 65%)',
          '5':  'hsl(28, 65%, 75%)',
          '6':  'hsl(60, 55%, 65%)',
          '7':  'hsl(70, 70%, 50%)',
          '8':  'hsl(80, 80%, 45%)',
          '9':  'hsl(90, 85%, 40%)',
          '10': 'hsl(100, 90%, 35%)'
        }[score];
      };

      return this;
    }
  ]);
