mockExplain = {'match': true,'value':0.10034258,'description':'product of:','details':[{'match':true,'value':0.20068516,'description':'sum of:','details':[{'match':true,'value':0.20068516,'description':'weight(text:law in 8543) [DefaultSimilarity], result of:','details':[{'match':true,'value':0.20068516,'description':'score(doc=8543,freq=1.0 = termFreq=1.0\n), product of:','details':[{'match':true,'value':0.21876995,'description':'queryWeight, product of:','details':[{'match':true,'value':2.4462245,'description':'idf(docFreq=4743, maxDocs=20148)'},{'match':true,'value':0.08943167,'description':'queryNorm'}]},{'match':true,'value':0.9173342,'description':'fieldWeight in 8543, product of:','details':[{'match':true,'value':1,'description':'tf(freq=1.0), with freq of:','details':[{'match':true,'value':1,'description':'termFreq=1.0'}]},{'match':true,'value':2.4462245,'description':'idf(docFreq=4743, maxDocs=20148)'},{'match':true,'value':0.375,'description':'fieldNorm(doc=8543)'}]}]}]}]},{'match':true,'value':0.5,'description':'coord(1/2)'}]};


var addExplain = function(solrResp) {
  solrResp.debug = {explain:{}};
  angular.forEach(solrResp.response.docs, function(doc) {
    solrResp.debug.explain[doc.id] = mockExplain;
  });
};
