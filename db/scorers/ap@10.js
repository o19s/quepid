let k = 10; // @Rank
let count = 0;
let totalRel = 0;
total = 0;
// if less than K results, need to reduce K now or final score is too low
k = numReturned() < k ? numReturned() : k
// for each returned document, calculate precision each time a new
// relevant document is added to the ranked list.
eachDoc(function(doc, i) {
    if (hasDocRating(i) && (docRating(i)) > 0) {
        count++;
    total += count/(i+1)
    }
}, k);
// count up the total number of relevant (not judged) documents
eachDocWithRating(function(doc) {
    if (doc.rating > 0) {
        totalRel++;
    }
});
	     
// AP is the sum of the precision points divided by the total
// number of relevant documents
const score = total / totalRel;
setScore(score);
