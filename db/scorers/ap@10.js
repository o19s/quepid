var k = 10; // @Rank
total = 0;

// if less than K results, need to reduce K now or final score is too low
k = numReturned() < k ? numReturned() : k
// for each returned document, calculate precision each time a new
// relevant document is added to the ranked list.
var count = 0;
eachDoc(function(doc, i) {
    if (hasDocRating(i) && (docRating(i)) > 0) {
        count++;
    total += count/(i+1)
    }
}, k);
// count up the total number of relevant (not judged) documents
var totalRel = 0;
for (var i = 0; i < bestDocs.length; i++) {
    if (bestDocs[i].rating > 0) {
        totalRel++;
    }
}
// AP is the sum of the precision points divided by the total
// number of relevant documents
var score = total / totalRel;
setScore(score);
