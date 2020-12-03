var k = 10; // @Rank
total = 0;

// if less than K results, need to reduce K now or final score is too low
k = numReturned() < k ? numReturned() : k

eachDoc(function(doc, i) {
    total += avgRating(i+1)
}, k);

var score = total / k;
setScore(score);
