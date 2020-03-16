function _atK(vals,k) {
  k = k||10;
  var docs = vals.slice(0,k);
  return docs;
}

function _log2(x) {
  return Math.log(x) / Math.log(2);
}

function DCG(vals,k) {
  var docs = _atK(vals,k);
  var dcg = 0;
  for(var i=0;i<docs.length;i++){
    var d = _log2(i+2);
    var n = Math.pow(2,docs[i])-1;
    dcg+=d?(n/d):0;
  }
  return dcg;

}

function nDCG(vals,k) {
  var ideal = vals.slice(0,k).sort(function(a,b){return b-a});
  var n = DCG(vals,k);
  var d = DCG(ideal,k);
  return d?(n/d):0;
}

scores = []
eachDoc(function(doc, i) {
    if(hasDocRating(i)) {
        scores.push(docRating(i))
    } else {
        scores.push(2)
    }
}, 10)
setScore(nDCG(scores,10)*100);
