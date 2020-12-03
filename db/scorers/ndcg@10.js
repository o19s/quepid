var k = 10 // @Rank
var missing_rating = 0; // pessimistic assumption

var ideal = topRatings(k) // could return less than k if less than k docs have ratings
var missing_pad = Array(k - ideal.length).fill(missing_rating);
ideal = ideal.concat(missing_pad);

var scores = Array(k);
eachDoc(function (doc, i) {
  if (hasDocRating(i)) {
    scores[i] = (docRating(i));
  } else {
      scores[i] = missing_rating;
  }
}, k)

function DCG(vals, k) {
  var dcg = 0;
  for (var i = 0; i < k; i++) {
    var d = Math.log2(i + 2);
    var n = Math.pow(2, vals[i]) - 1;
    dcg += d ? (n / d) : 0;
  }
  return dcg;
}

function nDCG(vals, ideal, k) {
  var n = DCG(vals, k);
  var d = DCG(ideal, k);
  return d ? (n / d) : 0;
}

setScore(nDCG(scores, ideal, k));

