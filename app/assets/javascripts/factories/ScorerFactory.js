'use strict';
/*jslint latedef:false*/
(function() {
  angular.module('QuepidApp')
    .factory('ScorerFactory', [
      '$q', '$timeout',
      ScorerFactory
    ]);

  function ScorerFactory($q, $timeout) {
    var Scorer = function(data) {
      var self = this;

      if (angular.isUndefined(data)) {
        data = {};
      }

      if ( angular.isUndefined(data.scale) ) {
        data.scale = ['0', '1'];
        data.scaleWithLabels = scaleToScaleWithLabels(data.scale, null);
      }

      // Attributes
      self.code                   = data.code;
      self.showScaleLabels        = data.show_scale_labels || false;
      self.scaleWithLabels        = data.scale_with_labels;
      self.scale                  = data.scale;
      self.colors                 = scaleToColors(data.scale);
      self.displayName            = setDisplayName(data.name, data.communal);
      self.error                  = false;
      self.name                   = data.name;
      self.owned                  = data.owned;
      self.ownerId                = data.owner_id;
      self.ownerName              = data.owner_name;

      self.scorerId               = data.scorer_id;
      self.communal               = data.communal;

      self.teams                  = data.teams || [];

      // Functions
      self.avg100                 = avg100;
      self.baseAvg                = baseAvg;
      self.baseAvgRounded         = baseAvgRounded;
      self.checkCode              = checkCode;
      self.checkCodeExecutionTime = checkCodeExecutionTime;
      self.distanceFromBest       = distanceFromBest;
      self.editDistance           = editDistance;
      self.getColors              = getColors;
      self.hasLoop                = hasLoop;
      self.maxScore               = maxScore;
      self.runCode                = runCode;
      self.scaleToArray           = scaleToArray;
      self.scaleToColors          = scaleToColors;
      self.score                  = score;
      self.scaleToScaleWithLabels = scaleToScaleWithLabels;
      self.showScaleLabel         = showScaleLabel;
      self.teamNames              = teamNames;
      self.getBestRatings         = getBestRatings;


      const DEFAULT_NUM_DOCS = 10;


      // public functions
      // NOT in scoring_logic.js
      function getColors() {
        return scaleToColors(self.scale);
      }

      // NOT in scoring_logic.js
      function scaleToArray(string) {
        return string.replace(/^\s+|\s+$/g,'')
          .split(/\s*,\s*/)
          .map(function(item) {
            return parseInt(item, 10);
          });
      }

      // NOT in scoring_logic.js
      function scaleToColors (scale) {
        var colorMap = {};

        if (scale === undefined || scale.length === 0) {
          return colorMap;
        }

        if (angular.isString(scale)) {
          scale = scaleToArray(scale);
        }

        var min = scale[0];
        var max = scale[scale.length - 1];

        var range = max - min;


        angular.forEach(scale, function(number) {
          var n = (number - min) * 120 / range;

          if ( isNaN(n) ) {
            n = 0;
          }

          colorMap[number] = { color: 'hsl(' + n + ', 100%, 50%)' };

          if ( self.showScaleLabels && self.scaleWithLabels !== null) {
            colorMap[number].showScaleLabels  = true;
            colorMap[number].label            = self.scaleWithLabels[number];
          }
        });

        return colorMap;
      }

      // NOT in scoring_logic.js
      function scaleToScaleWithLabels(scale, scaleWithLabels) {
        if ( angular.isUndefined(scaleWithLabels) || scaleWithLabels === null ) {
          scaleWithLabels = {};
        }

        if ( angular.isString(scale) ) {
          scale = scale.split(/,\s*/);
        }

        angular.forEach(scale, function(value) {
          if ( value.length >= 1 && (angular.isUndefined(scaleWithLabels[value]) || scaleWithLabels[value] === null) ) {
            scaleWithLabels[value] = '';
          }
        });

        return scaleWithLabels;
      }

      // NOT in scoring_logic.js
      function setDisplayName(name, communal) {
        if ( communal === true ) {
          return name + ' (Communal)';
        } else {
          return name;
        }
      }

      // NOT in scoring_logic.js
      function showScaleLabel(value) {
        return  self.showScaleLabels === true &&
                self.scaleWithLabels !== null &&
                angular.isDefined(self.scaleWithLabels) &&
                angular.isDefined(self.scaleWithLabels[value]);
      }

      // NOT in scoring_logic.js
      function teamNames() {
        var teams = [];
        angular.forEach(self.teams, function(team) {
          teams.push(team.name);
        });

        return self.teamName || teams.join(', ');
      }

      // NOT in scoring_logic.js
      function baseAvg(docs, count) {
        var sum = 0.0;
        var docsRated = 0;

        if ( angular.isUndefined(count) ) {
          count = DEFAULT_NUM_DOCS;
        }
        if ( count > docs.length ) {
          count = docs.length;
        }

        for (var i = 0; i < count; i++) {
          if (docs[i].hasRating()) {
            sum += parseInt(docs[i].getRating(), 10);
            docsRated += 1;
          }
        }

        if (docsRated > 0) {
          return sum / docsRated;
        } else {
          return null;
        }
      }

      // NOT in scoring_logic.js
      function baseAvgRounded(docs, count) {
        var avg = self.baseAvg(docs, count);
        return Math.floor(avg);
      }

      // NOT in scoring_logic.js
      function avg100(docs, count) {
        var max         = self.scale[self.scale.length -1];
        var multiplier  = 100 / max;
        var avg         = self.baseAvg(docs, count);

        if (!avg) {
          return null;
        } else {
          return Math.floor(avg * multiplier);
        }
      }

      // NOT in scoring_logic.js
      function editDistance(str1, str2) {

        var makeZeroArr = function(len) {
          var rVal = new Array(len);
          for (var i = 0; i < len; i++) {
            rVal[i] = 0;
          }
          return rVal;
        };

        var d = [];
        for (var i = 0; i < str1.length; i++) {
          d[i] = makeZeroArr(str2.length);
        }

        var getD = function(i, j) {
          if (i < 0 || j < 0 || d.length === 0) {
            return 0;
          }
          return d[i][j];
        };

        for (i = 0; i < str1.length; i++) {
          for (var j = 0; j < str2.length; j++) {
            var cost = 1;
            if (str1[i] === str2[j]) {
              cost = 0;
            }

            d[i][j] = Math.min( getD(i-1, j) + 1, //deletion
                                getD(i, j-1) + 1,
                                getD(i-1, j-1) + cost);
          }
        }
        return getD(str1.length - 1, str2.length - 1);
      }

      // return the ratings as an array from the top-N (count) documents stored in Quepid for a query
      // works globally, not restricted to just search engine results, could be ratings generated via
      // the 'Missing Documents' modal UI.
      function getBestRatings(count, bestDocs) {
        var bestDocsRatings = bestDocs.slice(0, count).map(function(x) {return x.rating;});

        return bestDocsRatings;
      }

      // NOT in scoring_logic.js
      function distanceFromBest(docs, bestDocs, count) {
        if ( angular.isUndefined(count) ) {
          count = DEFAULT_NUM_DOCS;
        }
        var bestCount = count; // this has to be done 2nd to make sure default is set

        if ( count > docs.length ) {
          count = docs.length;
        }
        if ( bestCount > bestDocs.length ) {
          bestCount = bestDocs.length;
        }

        var toArrOfRatings = function(docs) {
          var rVal = [];

          for (var i = 0; i < count; i++) {
            if (docs[i].hasRating()) {
              rVal.push(parseInt(docs[i].getRating(), 10));
            } else {
              rVal.push(null);
            }
          }

          return rVal;
        };

        var docsRatings = toArrOfRatings(docs);
        var bestDocsRatings = [];

        for (var i = 0; i < bestCount; i++) {
          bestDocsRatings.push(bestDocs[i].rating);
        }

        var rem = count - bestCount;

        for (i = 0; i < rem; i++) {
          bestDocsRatings.push(null);
        }
        return Math.floor(self.editDistance(docsRatings, bestDocsRatings));
      }

      var hasLoop = function () {
        return $q(function(resolve, reject) {
          var matches = self.code.match(/(while|for)\s*\(/g);

          if (matches) {
            return reject('Loops are currently not supported, use `eachDoc` to loop over documents.');
          } else {
            return resolve('Passes the loop test.');
          }
        });
      };

      // TODO:
      // Get this to work!
      // This is a prototype of how we think it should work,
      // ported from the old service.
      // We could not get this to work/test, and spent too much time on it.
      // Leaving it here until we do figure out
      // -YC
      // NOT in scoring_logic.js
      function checkCodeExecutionTime() {
        return $q(function(resolve, reject) {
          var myWorker = new Worker('scripts/scorerEvalTest.js');

          var timeoutP = $timeout(function() {
            var error = 'Your test takes too long to execute, please rework it.';
            myWorker.terminate();
            return reject(error);
          }, 1000, false);

          myWorker.postMessage({code: self.code});

          myWorker.onmessage = function() {
            $timeout.cancel(timeoutP);
            return resolve('Code finishes in a reasonable time.');
          };
        });
      }

      // NOT in scoring_logic.js
      function checkCode() {
        var deferred    = $q.defer();
        var loopPromise = hasLoop();
        // var timePromise = self.checkCodeExecutionTime();

        $q.all([loopPromise])
          .then(function() {
            deferred.resolve('Code passes.');
          }, function(message) {
            deferred.reject(message);
          });

        return deferred.promise;
      }

      // mode may no longer be used..  maybe it was for unit test style scorers?
      // NOT in scoring_logic.js
      function runCode(query, total, docs, bestDocs, mode, options) {
        var scale     = self.scale;
        var max       = scale[scale.length-1];

        var scorerDeferred = $q.defer();

        // Normalize how you get the rating of a doc
        angular.forEach(bestDocs, function(doc) {
          if ( doc.hasOwnProperty('getRating') && typeof doc.getRating === 'function' ) {
            // noop (I don't feel like using the negative of this condition)
          } else {
            doc.getRating = function() {
              return doc.rating;
            };
          }
        });

        if (mode !== undefined) {
          var queryDocs = [];
          angular.forEach(docs, function(doc) {
            var qd = angular.copy(doc);
            qd.getRating = function() {
              if (mode === 'max') {
                return max;
              }
            };
            queryDocs.push(qd);
          });
          docs = queryDocs;
        }

        var docAt = function(posn) {
          if (posn >= docs.length) {
            return {};
          } else {
            return docs[posn].doc;
          }
        };

        var docExistsAt = function(posn) {
          if (posn >= docs.length) {
            return false;
          }
          return true;
        };

        var ratedDocAt = function(posn) {
          if (posn >= query.ratedDocs.length) {
            return {};
          } else {
            return query.ratedDocs[posn];
          }
        };


        var ratedDocExistsAt = function(posn) {
          if (posn >= query.ratedDocs.length) {
            return false;
          }
          return true;
        };


        /*jshint unused:false */
        var hasDocRating = function(posn) {
          return docExistsAt(posn) && docs[posn].hasRating();
        };

        var docRating = function(posn) {
          if (docExistsAt(posn)) {
             return docs[posn].getRating();
          }
          return undefined;
        };

        var numFound = function() {
          return total;
        };

        var numReturned = function() {
          return docs.length;
        };

        var avgRating = function(count) {
          return baseAvg(docs, count);
        };

        // NOT in scoring_logic.js
        var avgRating100 = function(count) {
          return avg100(docs, count);
        };

        // NOT in scoring_logic.js
        var editDistanceFromBest = function(count) {
          return distanceFromBest(docs, bestDocs, count);
        };

        var eachDoc = function(f, count) {
          if ( angular.isUndefined(count) ) {
            count = DEFAULT_NUM_DOCS;
          }

          var i = 0;
          for (i = 0; i < count; i++) {
            if (docExistsAt(i)) {
              f(docAt(i), i);
            }
          }
        };

        var eachRatedDoc = function(f, count) {
          if ( angular.isUndefined(count) ) {
            count = DEFAULT_NUM_DOCS;
          }

          var i = 0;
          for (i = 0; i < count; i++) {
            if (ratedDocExistsAt(i)) {
              f(ratedDocAt(i), i);
            }
          }
        };

        // may not be called
        // NOT in scoring_logic.js
        var refreshRatedDocs = function(k) {
          return query.refreshRatedDocs(k);
        };


        // Loops through all docs that have a rating equal to the
        // param that is passed, and calls the callback function on
        // each doc.
        // Even those that are not in the top 10 current.
        // may not be used?
        // NOT in scoring_logic.js
        //
        // @param score,  Int
        // @param f,      Callback
        var eachDocWithRatingEqualTo = function(score, f) {
          for (var i = 0; i < bestDocs.length; i++) {
            if (bestDocs[i].rating === score) {
              f(bestDocs[i]);
            }
          }
        };

        // Loops through all docs that have been rated, and calls
        // the callback function on each doc.
        // Even those that are not in the top 10 current.
        //
        // @param f, Callback
        var eachDocWithRating = function(f) {
          var i = 0;
          for (i = 0; i < bestDocs.length; i++) {
            f(bestDocs[i]);
          }
        };

        var topRatings = function(count) {
          return getBestRatings(count, bestDocs);
        };

        var qOption = function(key) {
          if ( options !== undefined && options !== null && options.hasOwnProperty(key) ) {
            return options[key];
          } else {
            return null;
          }
        };

        // NOT in scoring_logic.js
        var recordDepthOfRanking = function (k){
          query.depthOfRating = k;
          self.depthOfRating = k;
        };

        // NOT in scoring_logic.js
        /*jshint unused:false */
        function pass() {
          scorerDeferred.resolve(100);
        }

        // NOT in scoring_logic.js
        function fail() {
          scorerDeferred.reject(0);
        }

        function setScore(score) {
          scorerDeferred.resolve(score);
        }

        // NOT in scoring_logic.js
        function assert(cond) {
          if (!cond) {
            fail();
          }
        }

        // NOT in scoring_logic.js
        function assertOrScore(cond, score) {
          if (!cond) {
            setScore(score);
          }
        }


        if (mode === 'max' && self.code.indexOf('pass()') > -1) {
          return 100;
        }

        // We can manipulate the base scorer code by just appending JS
        // to what the user has entered in order to detect and extract
        // the k parameter as the depth of scoring.
        var appendRecordDepthOfRankingCode = [
          '\n',
          'if (typeof k !== \'undefined\') {',
          '  recordDepthOfRanking(k);',
          '}',
        ].join('\n');

        var kode = self.code;
        kode+= appendRecordDepthOfRankingCode;

        $timeout(function() {
          /*jshint evil:true */
          eval(kode);
          /*jshint evil:false */
        }, 1);

        return scorerDeferred.promise;
      }

      function maxScore() {
        return self.scale[-1];
      }

      function score(query, total, docs, bestDocs, options) {
        bestDocs = bestDocs || [];

        /** 
        Now allowing the scorer to be run regardless of if we have ratings or a ZSR.
        The special logic for those situations is after running the scorer.
        if (bestDocs.length === 0 || docs.length === 0) {
          let label = null;
          // Don't score if there are no ratings
          if (bestDocs.length === 0) {
            label = '--';
          }
          // Set to ZSR if there are no docs
          if (docs.length === 0) {
            label = 'zsr';
          }
          var d = $q.defer();
          d.resolve(label);
          return d.promise;
        }
        **/

        var maxScore  = self.maxScore();
        return self.runCode(
          query,
          total,
          docs,
          bestDocs,
          undefined,
          options
        ).then(function(calcScore){
          //window.alert('query ' + query.queryText + ' socre:' + calcScore);
          // Set to ZSR if there are no docs
          if (calcScore === null){
            if (docs.length === 0) {
              return 'zsr';
            }
            if (bestDocs.length === 0) {
              return '--';
            }
          }
          if (angular.isNumber(calcScore)) {
            if (calcScore < 0 && calcScore === maxScore) {
              return null;
            }

            if (calcScore < 0) {
              return 0;
            }
            else if (calcScore > maxScore) {
              return maxScore;
            }

            if (maxScore === 0) {
              return 0;
            }

            return calcScore;
          } else {
            self.error = calcScore;
            return null;
          }
        }, function(reject) {
          self.error = reject;
          return null;
        });
      }

    };

    return Scorer;
  }
})();
