
'use strict';

(function (wind) {
  var MockScorer = function(scorerCode) {

    this.lastQueryText = null;
    this.lastDocs = null;
    this.lastBestDocs = null;

    this.score = function(query, queryText, docs, bestDocs) {
      this.lastQueryText = queryText;
      this.lastDocs = docs;
      this.lastBestDocs = bestDocs;
      return 100;
    };

    this.maxScore = function(query, queryText, docs, bestDocs) {
      return 100;
    };

    this.scoreToColor = function(score, maxScore) {
      return '#008900';
    };

    this.code = function() {
      return scorerCode;
    };
  };

  wind.MockCustomScorerSvc = function() {

    var scorers = {};
    this.defaultScorer = new MockScorer('default-code');

    this.createScorer = function(scoreCode) {
      return new MockScorer(scoreCode);
    };

    this.bootstrap = function() {};

    this.get = function(scoreId) {
      return {
        then: function(fn) {
          fn(scorers[scoreId]);
        }
      };
    };

    this.constructFromData = function(data) {
      return data;
    };

    this.edit = function(scorer) {
      scorers[scorer.id] = scorer;

      return {
        then: function(fn) {
          fn( scorer );
        }
      };
    };

    this.create = function(scorer) {
      var id = '' + Object.keys(scorers).length;
      scorers[id] = scorer;
      scorer.scorerId = id;

      return {
        then: function(fn) {
          fn(scorer);
        }
      };
    };

  };

})(window);

