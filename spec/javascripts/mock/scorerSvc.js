
'use strict';

(function (wind) {
  var MockScorer = function(scorerCode) {

    this.lastQueryText = null;
    this.lastDocs      = null;
    this.lastBestDocs  = null;
    this.id            = Math.random();

    this.score = function(queryText, docs, bestDocs) {
      this.lastQueryText = queryText;
      this.lastDocs = docs;
      this.lastBestDocs = bestDocs;
      return 100;
    };

    this.maxScore = function(queryText, docs, bestDocs) {
      return 100;
    };

    this.scoreToColor = function(score, maxScore) {
      return '#008900';
    };

    this.code = function() {
      return scorerCode;
    };
  };
})(window);
