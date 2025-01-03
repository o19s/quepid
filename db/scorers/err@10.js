var k = 10 // @Rank
var scores = Array(k);
var missing_rating = 0; // pessimistic assumption
// if less than K results, need to reduce K now or final score is too low
k = numReturned() < k ? numReturned() : k

for (var i = 0; i < k; i++) {
  if (hasDocRating(i)) {
    scores[i] = (docRating(i));
  } else {
    scores[i] = missing_rating;
  }
}

function gain(grade, maxGrade=3.0) {
    return (Math.pow(2,grade) - 1.0)/Math.pow(2,maxGrade)
}
function err(lst, maxG=3.0) {
    trust = 1.0
    for (i = 0; i < lst.length; i++) {
        rank = i + 1.0
        pUseful = gain(lst, maxG)
        disc = pUseful/rank
        ERR = ERR + trust * disc
        trust = trust * (1.0 - pUseful)
    }
    return ERR
}
setScore(err(scores))
