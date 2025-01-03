let k = 10 // @Rank
// if less than K results, need to reduce K now or final score is too low
k = numReturned() < k ? numReturned() : k
let scores = Array(k);
let missing_rating = 0; // pessimistic assumption

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
    var ERR = 0.0
    var trust = 1.0
    for (var i = 0; i < lst.length; i++) {
        var rank = i + 1.0
        var pUseful = gain(lst[i], maxG)
        var disc = pUseful/rank
        ERR = ERR + trust * disc
        trust = trust * (1.0 - pUseful)
    }
    return ERR
}
setScore(err(scores))
