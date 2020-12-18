
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

      // Somehow $q can be injected here instead of using raw promises
      var resolve = function(data) {
        return data;
      };

      var promise = new Promise(resolve);
      resolve(100);

      return promise;
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
