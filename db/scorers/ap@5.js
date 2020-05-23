var k = 5; // @Rank
total = 0

eachDoc(function(doc, i) {
    total += avgRating(i+1)
}, k);

var score = total / k;
setScore(score);
