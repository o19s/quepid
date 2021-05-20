var k = 10 // @Rank
var score = 0;

eachDoc(function(doc, i) {
    var d = Math.log2(i+2); // i is the JSindex not the DocRank; 0 vs 1
    var n = docRating(i);
    score += d?(n/d):0;
}, k)

setScore(score);