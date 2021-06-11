'use strict';

describe('Service: ScorerFactory', function () {

  beforeEach(module('QuepidTest'));
  var $rootScope, $q, $timeout, customScorerSvc, scorer;

  beforeEach(inject(function(_$rootScope_, _$q_, _$timeout_, _customScorerSvc_) {
    $q              = _$q_;
    $rootScope      = _$rootScope_;
    $timeout        = _$timeout_;
    customScorerSvc = _customScorerSvc_;

    var mockScorer = {
      'scorerId': 1,
      'name':     'Scorer 1',
      'code':     customScorerSvc.defaultAlgorithm,
      'scale':    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      'owner_id': 1
    };

    scorer = customScorerSvc.constructFromData(mockScorer);
  }));

  // mock querydocs
  var makeDocs = function(docArray) {
    var queryDocs = [];
    angular.forEach(docArray, function(doc) {
      var qd = angular.copy(doc);
      qd.hasRating = function() {
          return this.hasOwnProperty('rating');
        };
      qd.getRating = function() {
        if (this.hasRating()) {
          return this.rating;
        }
        return null;
      };
      queryDocs.push(qd);
    });
    return queryDocs;
  };

  describe('Code Checker', function () {
    it('checks code for a loop and returns an error', function () {
      var result;

      var expectedResult = 'Loops are currently not supported, ' +
        'use `eachDoc` to loop over documents.';

      var code = [
        'while (true) {',
        '  // some code goes here...',
        '}',
        'setScore(score);',
      ].join('\n');

      scorer.code = code;
      scorer.checkCode()
        .then(function() {
          result = 'passed';
        }, function(message) {
          result = message;
        });

        $rootScope.$apply();

        expect(result).toBe(expectedResult);
    });

    // it('checks code for a long execution time returns an error', function () {
    //   var result;

    //   var expectedResult = 'Your test takes too long to execute, please rework it.'

    //   var code = [
    //     'setTimeout(function() {',
    //     '  // some code goes here...',
    //     '}, 3000);',
    //     'setScore(score);',
    //   ].join('\n');

    //   scorer.code = code;

    //   scorer.checkCode()
    //     .then(function() {
    //       result = "passed";
    //     }, function(message) {
    //       result = message;
    //     });

    //   $rootScope.$apply();
    //   $timeout.flush();

    //   expect(result).toBe(expectedResult);
    // });

    it('checks code and passes if it does not take too long & does not have any loops', function () {
      var result;

      scorer.checkCode()
        .then(function() {
          result = 'passed';
        }, function(message) {
          result = message;
        });

      $rootScope.$apply();
      expect(result).toBe('passed');
    });
  });

  describe('Average Rating', function () {
    it('calculates the base average for a set of docs based on the default scale', function () {
      var docs    = makeDocs([{rating: 10}, {rating: 9}, {rating: 8}, {rating: 7}]);
      var rating  = scorer.baseAvg(docs);
      expect(rating).toBe((10 + 9 + 8 + 7) / 4);
    });

    it('calculates the rounded base average for a set of docs based on the default scale', function () {
      var docs    = makeDocs([{rating: 10}, {rating: 9}, {rating: 8}, {rating: 7}]);
      var rating  = scorer.baseAvgRounded(docs);
      expect(rating).toBe(Math.floor((10 + 9 + 8 + 7) / 4));
    });

    it('calculates the 100 base average for a set of docs based on the default scale', function () {
      var docs    = makeDocs([{rating: 10}, {rating: 9}, {rating: 8}, {rating: 7}]);
      var rating  = scorer.avg100(docs);
      expect(rating).toBe(Math.floor((10 + 9 + 8 + 7) / 4 * 10));
    });

    it('calculates the base average for a set of docs based on a custom scale', function () {
      scorer.scale  = [1, 2, 3, 4];
      var docs      = makeDocs([{rating: 1}, {rating: 2}, {rating: 2}, {rating: 4}]);
      var rating    = scorer.baseAvg(docs);
      expect(rating).toBe((1 + 2 + 2 + 4) / 4);
    });

    it('calculates the rounded base average for a set of docs based on a custom scale', function () {
      scorer.scale  = [1, 2, 3, 4];
      var docs      = makeDocs([{rating: 1}, {rating: 2}, {rating: 2}, {rating: 4}]);
      var rating    = scorer.baseAvgRounded(docs);
      expect(rating).toBe(Math.floor((1 + 2 + 2 + 4) / 4));
    });

    it('calculates the 100 base average for a set of docs based on a custom scale', function () {
      scorer.scale  = [1, 2, 3, 4];
      var docs      = makeDocs([{rating: 1}, {rating: 2}, {rating: 2}, {rating: 4}]);
      var rating    = scorer.avg100(docs);
      expect(rating).toBe(Math.floor((1 + 2 + 2 + 4) / 4 * 25));
    });
  });

  describe('Scoring', function () {
    var checkExpectation = function(num, docs, best, expectation) {
      var score;
      score = scorer.score({}, num, docs, best);
      $rootScope.$apply();

      score.then(function(scoreValue) {
        expect(scoreValue).toBe(expectation);
      });
    };

    it('scores avg on no difference', function() {
      var docs = makeDocs([{rating: 10}, {rating:10}, {rating:9}]);
      var bestDocs = [{rating: 10}, {rating: 10}, {rating: 9}];

      checkExpectation(521, docs, bestDocs, 96);
    });

    it('scores avg on no difference but extra docs', function() {
      var docs      = makeDocs([{rating: 10}, {rating:10}, {rating:9}, {}, {}]);
      var bestDocs  = [{rating: 10}, {rating: 10}, {rating: 9}];

      checkExpectation(521, docs, bestDocs, 96);
    });

    it('scores below avg on one difference', function() {
      var docs      = makeDocs([{rating: 9}, {rating:10}, {rating:9}]);
      var bestDocs  = [{rating: 10}, {rating: 10}, {rating: 9}];

      var score;
      score = scorer.score(521, docs, bestDocs);

      $timeout(function() {
          $rootScope.$apply();
          expect(score).toBeLessThan(96);
        }, 1002, false);
    });

    it('returns avg on no best docs', function() {
      var docs      = makeDocs([{rating: 9}, {rating:10}, {rating:9}]);
      var bestDocs  = [];

      checkExpectation(521, docs, bestDocs, 90);
    });

    it('returns null on no rated docs', function() {
      var docs      = makeDocs([{}, {}, {}]);
      var bestDocs  = [{rating: 10}, {rating: 10}, {rating: 9}];

      checkExpectation(521, docs, bestDocs, null);
    });

    it('returns no score on no docs', function() {
      var docs      = makeDocs([]);
      var bestDocs  = [{rating: 10}, {rating: 10}, {rating: 9}];

      checkExpectation(0, docs, bestDocs, null);
    });

    it('playing around', function() {
      var docs = makeDocs([{rating: 10}, {rating: 9}, {rating: 9},
                           {rating: 8},  {rating: 6}, {rating: 6},
                           {rating: 8}, {rating: 6}, {rating: 6},
                           {rating: 5}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      checkExpectation(521, docs, bestDocs, 68);
    });

    it('only scores first 10 docs by default', function() {
      var docs = makeDocs([{rating: 10}, {rating: 9}, {rating: 9},
                           {rating: 8},  {rating: 6}, {rating: 6},
                           {rating: 8}, {rating: 6}, {rating: 6},
                           {rating: 5}, {rating: 5}, {rating: 5}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      checkExpectation(521, docs, bestDocs, 68);
    });

    it('scores first N docs', function() {
      var docs = makeDocs([{rating: 10}, {rating: 9}, {rating: 9},
                           {rating: 8},  {rating: 6}, {rating: 6},
                           {rating: 8}, {rating: 6}, {rating: 6},
                           {rating: 5}, {rating: 5}, {rating: 5}]);
      var bestDocs = [{rating: 10}, {rating: 9}];

      scorer.code = 'var score = avgRating100(11); setScore(score);';
      checkExpectation(521, docs, bestDocs, 70);
    });

    it('scores even if search results missing', function() {
      var docs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 8},
      ]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9}];

      scorer.manualMaxScore = true;
      scorer.code = [
        'var score = 0;',
        'var perfectScore = 0;',
        'for (var ndx = 0; ndx < 10; ndx++) {',
        '    if (hasDocRating(ndx)) {',
        '        var desiredRating = 10 - ndx;',
        '        score += desiredRating * (10 - Math.abs(docRating(ndx) - desiredRating));',
        '        perfectScore += desiredRating * 10;',
        '    }',
        '}',
        'var finalScore = 0;',
        'if (perfectScore > 0) {',
        '    finalScore = Math.round((score / perfectScore) * 100);',
        '}',
        'setScore(finalScore);',
      ].join('\n');

      checkExpectation(521, docs, bestDocs, 100);

      var docs = makeDocs([
        {rating: 10},
        {rating: 10},
        {rating: 10},
      ]);

      checkExpectation(521, docs, bestDocs, 91);
    });

    it('scores even if search results missing', function() {
      var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      scorer.code = 'assert(docAt(1).title === \'cat\')';
      checkExpectation(100, docs, bestDocs, 0);

      scorer.code = 'assert(docExistsAt(1))';
      checkExpectation(100, docs, bestDocs, 0);

      scorer.code = 'assert(docExistsAt(0)); pass();';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docExistsAt(0));';
      checkExpectation(100, docs, bestDocs, null);
    });

    it('assert on doc attribute works', function() {
      var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}]);
      var bestDocs = [
        {rating: 10}, {rating: 9}, {rating: 9},
        {rating: 8},  {rating: 8}, {rating: 7},
        {rating: 7},  {rating: 7}, {rating: 6}
      ];

      scorer.code = 'assert(docAt(0).title === \'boo\'); pass();';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docAt(0).title === \'foo\'); pass();';
      checkExpectation(100, docs, bestDocs, 0);
    });

    it('assert on other doc attribute works', function() {
      var docs = makeDocs([
        {rating: 10, doc:
          {'title': 'boo', 'catch_line': 'foo'}
        }
      ]);

      var bestDocs = [
        {rating: 10}, {rating: 9}, {rating: 9},
        {rating: 8},  {rating: 8}, {rating: 7},
        {rating: 7},  {rating: 7}, {rating: 6}
      ];

      scorer.code = 'assert(docAt(0).catch_line === \'boo\'); pass();';
      checkExpectation(100, docs, bestDocs, 0);

      scorer.code = 'assert(docAt(0).catch_line === \'foo\'); pass();';
      checkExpectation(100, docs, bestDocs, 100);
    });

    it('numFound works', function() {
      var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      scorer.code = 'assert(numFound() === 100); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(numFound() === 99); pass()';
      checkExpectation(100, docs, bestDocs, 0);

      scorer.code = 'assert(numReturned() === 1); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(numReturned() === 100); pass()';
      checkExpectation(100, docs, bestDocs, 0);
    });

    it('docRating etc works', function() {
      var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      scorer.code = 'assert(docRating(0) === 10); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(0) === 1); pass()';
      checkExpectation(100, docs, bestDocs, 0);

      scorer.code = 'assert(docRating(1) === 1); pass()';
      checkExpectation(100, docs, bestDocs, 0);

      scorer.code = 'assert(hasDocRating(0)); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(hasDocRating(1)); pass()';
      checkExpectation(100, docs, bestDocs, 0);

      var docs = makeDocs([
        {rating: 10,  doc: {'title': 'boo'}},
        {rating: 9,   doc: {'title': 'boo'}},
        {rating: 8,   doc: {'title': 'boo'}},
        {rating: 7,   doc: {'title': 'boo'}},
        {rating: 6,   doc: {'title': 'boo'}},
        {rating: 5,   doc: {'title': 'boo'}},
        {rating: 4,   doc: {'title': 'boo'}},
        {rating: 3,   doc: {'title': 'boo'}},
        {rating: 2,   doc: {'title': 'boo'}},
        {rating: 1,   doc: {'title': 'boo'}},
        {rating: 0,   doc: {'title': 'boo'}},
      ]);

      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      scorer.code = 'assert(docRating(0) === 10); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(1) === 9); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(2) === 8); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(3) === 7); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(4) === 6); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(5) === 5); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(6) === 4); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(7) === 3); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(8) === 2); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(9) === 1); pass()';
      checkExpectation(100, docs, bestDocs, 100);

      scorer.code = 'assert(docRating(10) === 0); pass()';
      checkExpectation(100, docs, bestDocs, 100);
    });

    it('eachDoc works', function() {
      var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}, {rating: 8, doc: {}}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      var eachDocTest = ['var score = 0;',
                         'eachDoc(function(doc, i) {',
                         '  score += docRating(i); ',
                         '});',
                         'setScore(score)'].join('\n');

      scorer.code = eachDocTest;
      checkExpectation(100, docs, bestDocs, 18);
    });

    it('allows for a custom number of docs with eachDoc', function() {
      var docs = makeDocs([
        {rating: 10, doc: {'title': 'boo'}},
        {rating: 9,  doc: {'title': 'foo'}},
        {rating: 9,  doc: {'title': 'bar'}},
        {rating: 8,  doc: {}}
      ]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      var eachDocTest = [
        'var score = 0;',
        'eachDoc(function(doc, i) {',
        '  score += docRating(i); ',
        '}, 2);',
        'setScore(score)'
      ].join('\n');

      scorer.code = eachDocTest;
      checkExpectation(100, docs, bestDocs, 19);
    });

    it('does not allow loops', function() {
      var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}]);
      var bestDocs = [{rating: 10}, {rating: 9}, {rating: 9},
                      {rating: 8}, {rating: 8}, {rating: 7},
                      {rating: 7}, {rating: 7}, {rating: 6}];

      scorer.code = 'while(true) {}; pass()';
      //scorer.score(100, docs, bestDocs);
      scorer.checkCode();
      $timeout(function() {
        $rootScope.$apply();
        expect(scorer.error).toContain('Loops are currently not supported, use eachDoc to loop over documents');
      }, 100, false);

      scorer.code = 'while (true) {}; pass()';
      //scorer.score(100, docs, bestDocs);
      scorer.checkCode();
      $timeout(function() {
        $rootScope.$apply();
        expect(scorer.error).toContain('Loops are currently not supported, use eachDoc to loop over documents');
      }, 100, false);

      scorer.code = 'for (true) {}; pass()';
      //scorer.score(100, docs, bestDocs);
      scorer.checkCode();
      $timeout(function() {
        $rootScope.$apply();
        expect(scorer.error).toContain('Loops are currently not supported, use eachDoc to loop over documents');
      }, 100, false);
    });

    it('can loop through all docs with ratings', function() {
      var docs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 8},
      ]);

      var bestDocs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 9},
      ]);

      scorer.code = [
        'var score = 0;',
        'eachDocWithRating(function(doc) {',
        '  score += doc.getRating() % 3;',
        '});',
        'setScore(score);',
      ].join('\n');

      checkExpectation(521, docs, bestDocs, 1);
    });

    it('can loop through all docs with a specific ratings', function() {
      var docs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 8},
      ]);

      var bestDocs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 9},
      ]);

      scorer.code = [
        'var score = 0;',
        'eachDocWithRatingEqualTo(9, function() {',
        '  score++;',
        '});',
        'setScore(score);',
      ].join('\n');

      checkExpectation(521, docs, bestDocs, 2);
    });

    it('eachDocWithRatingEqualTo works in custom functions', function() {
      var docs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 8},
      ]);

      var bestDocs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 9},
      ]);

      scorer.code = [
        'function appendDocsWithRating(rating, ratList) {',
        '  eachDocWithRatingEqualTo(rating, function gather(doc) {',
        '    ratList.push(doc.getRating());',
        '  });',
        '}',
        '',
        'var ratList = []',
        'appendDocsWithRating(3, ratList);',
        'setScore(ratList.length);',
      ].join('\n');

      checkExpectation(521, docs, bestDocs, 0);
    });

    it('topRatings() returns the proper number of rating', function() {
      var docs = makeDocs([
        {rating: 10},
        {rating: 9},
        {rating: 8},
        {rating: 7}
      ]);
      var bestDocs = [
        {rating: 10},
        {rating: 9},
        {rating: 8},
        {rating: 7}
      ];
      scorer.code = 'assert(JSON.stringify(topRatings(2)) === "[10,9]"); pass()';

      checkExpectation(2, docs, bestDocs, 100)
    });

    //it('scripted scorer that always passes', function() {
      //var docs = makeDocs([{rating: 10, doc: {'title': 'boo'}}]);
      //scorer.code = 'pass()';
      //checkExpectation(1, docs, null, 100);
    //});

    //it('scripted scorer with error reports', function() {
      //scorer.code = 'butts';
      //scorer.score();
      //$timeout(function() {
        //$rootScope.$apply();
        //expect(scorer.error).not.toBeFalsy();
      //}, 1002, false);
    //});

    //it('transforms the score to the 1-100 scale', function() {
      //var docs = makeDocs([
        //{rating: 1}, {rating: 2}, {rating: 3},
        //{rating: 4}, {rating: 4}, {rating: 4},
        //{rating: 4}, {rating: 4}, {rating: 4}
      //]);

      //var bestDocs = makeDocs([
        //{rating: 1}, {rating: 2}, {rating: 3},
        //{rating: 4}, {rating: 4}, {rating: 4},
        //{rating: 4}, {rating: 4}, {rating: 4}
      //]);

      //scorer.code = [
        //'var score = avgRating();',
        //'setScore(score);',
      //].join('\n');
      //scorer.scale = [1, 2, 3, 4];
      //checkExpectation(100, docs, bestDocs, 83);
    //});
  });

  describe('Scale with Labels', function () {
    it('initializes an empty hash for a scale with labels', function() {
      var scale           = [1, 2, 3, 4];
      var scaleWithLabels = scorer.scaleToScaleWithLabels(scale);

      expect(scaleWithLabels).not.toBe(null);
      expect(scaleWithLabels[1]).toEqual('');
      expect(scaleWithLabels[2]).toEqual('');
      expect(scaleWithLabels[3]).toEqual('');
      expect(scaleWithLabels[4]).toEqual('');
    });

    it('does not override existing labels', function() {
      var scale           = [1, 2, 3, 4];
      var labels          = { 1: 'first' };
      var scaleWithLabels = scorer.scaleToScaleWithLabels(scale, labels);

      expect(scaleWithLabels).not.toBe(null);
      expect(scaleWithLabels[1]).toEqual('first');
      expect(scaleWithLabels[2]).toEqual('');
      expect(scaleWithLabels[3]).toEqual('');
      expect(scaleWithLabels[4]).toEqual('');
    });
  });
});
