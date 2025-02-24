const k = 10 // @Rank                                                             
const missing_rating = 0; // pessimistic assumption                               
let scores = Array(k);
let ideal = []
eachDocWithRating(function(doc) {
    ideal.push(doc.rating)
})
ideal.sort(function(a,b) { return b - a; });
//console.log(ideal)                                                            
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
  let dcg = 0;
  for (var j = 0; j < k; j++) {
    const d = Math.log2(j + 2);
    const n = Math.pow(2, vals[j]) - 1;
    dcg += d ? (n / d) : 0;
  }
  return dcg;
}

function nDCG(vals, ideal, k) {
  const n = DCG(vals, k);
  const d = DCG(ideal, ideal.length);
  return d ? (n / d) : 0;
}

setScore(nDCG(scores, ideal, k));
