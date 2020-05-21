var k = 5; // @Rank
var scores = [];
var docs_counted = 0;

eachDoc(function(doc, i) {
    scores.push(avgRating(i));
    docs_counted += 1;
}, k); // not sure why this isn't filling pos0
scores.shift(); //so remove the baddie

var score = scores.reduce((a,b) => a + b, 0) / docs_counted;
setScore(score);
