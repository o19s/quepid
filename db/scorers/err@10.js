let k = 10 // @Rank
// if less than K results, need to reduce K now or final score is too low
k = numReturned() < k ? numReturned() : k
const scores = Array(k);
const missing_rating = 0; // pessimistic assumption
let i = 0
for (i = 0; i < k; i++) {
  if (hasDocRating(i)) {
    scores[i] = (docRating(i));
  } else {
    scores[i] = missing_rating;
  }
}

function gain(grade, maxGrade) {
    return (Math.pow(2,grade) - 1.0)/Math.pow(2,maxGrade)
}
function err(lst) {
    let ERR = 0.0
    let trust = 1.0
    for (i = 0; i < lst.length; i++) {
        const rank = i + 1.0
	// max is the maximum possible rating for the scorer.
        const pUseful = gain(lst[i], max)
        const disc = pUseful/rank
        ERR = ERR + trust * disc
        trust = trust * (1.0 - pUseful)
    }
    return ERR
}
setScore(err(scores))
