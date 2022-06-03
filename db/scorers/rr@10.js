const k = 10; // @Rank
let rank = 0;
eachDoc(function(doc, i) {
    if (rank === 0 && hasDocRating(i) && (docRating(i)) > 0) {
        rank = i+1; // remember the rank of the first relevant document
     }
}, k);
const score = rank > 0 ? 1.0 / rank : 0.0;
setScore(score);
