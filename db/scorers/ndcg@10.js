var k = 10 // @Rank

var ideal = topRatings(k)

k = ideal.length < k ? ideal.length : k
var scores = Array(k).fill(0);

function DCG(vals, k) {
  var dcg = 0;
  for (var i = 0; i < k; i++) {
    var d = Math.log2(i + 2);
    var n = Math.pow(2, vals[i]) - 1;
    dcg += d ? (n / d) : 0;
  }
  return dcg;
}

function nDCG(vals, k) {
  var ideal = topRatings(k)
  var n = DCG(vals, k);
  var d = DCG(ideal, k);
  return d ? (n / d) : 0;
}

eachDoc(function (doc, i) {
  if (hasDocRating(i)) {
    scores[i] = (docRating(i));
  }
}, k)

setScore(nDCG(scores, k));
