var k = 10 // @Rank
var missing_rating = 0; // pessimistic assumption

var ideal = topRatings(k) // could return less than k if less than k docs have ratings
var scores = Array(k);
for (var i = 0; i < k; i++) {
  if (!ideal[i]) {
    ideal[i] = missing_rating;
  }
  if (hasDocRating(i)) {
    scores[i] = (docRating(i));
  } else {
    scores[i] = missing_rating;
  }
}

function DCG(vals, k) {
  var dcg = 0;
  for (var i = 0; i < k; i++) {
    var d = Math.log2(i + 2);
    var n = vals[i];
    dcg += d ? (n / d) : 0;
  }
  return dcg;
}

function nDCG(vals, ideal, k) {
  var n = DCG(vals, k);
  var d = DCG(ideal, k);
  return d ? (n / d) : 0;
}

let relevance = scores.slice();
relevance.sort(function(a, b) {
  return b - a;
});
setScore(nDCG(scores, relevance, k));

