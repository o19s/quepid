const topK = 10 // @Rank
const missing_rating = 0; // pessimistic assumption
const scores = Array(topK);
const ideal = []
eachDocWithRating(function(doc) {
    ideal.push(doc.rating)
})
ideal.sort(function(a,b) { return b - a; });
for (var i = 0; i < topK; i++) {
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
  let dcg = 0;
  for (var j = 0; j < k; j++) {
    let den = Math.log2(j + 2);
    let num = Math.pow(2, vals[j]) - 1;
    dcg += den ? (num / den) : 0;
  }
  return dcg;
}
function nDCG(vals, ideal, k) {
  const num = DCG(vals, k);
  const den = DCG(ideal, ideal.length);
  return den ? (num / den) : 0;
}
setScore(nDCG(scores, ideal, topK));
