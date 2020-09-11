var k = 10 // @Rank
var score = 0;

eachDoc(function(doc, i) {
    score += docRating(i);
}, k)

setScore(score);
