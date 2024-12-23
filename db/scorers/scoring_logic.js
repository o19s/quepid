function scoreItems(items, options) {
  // Log something using Ruby's logger
  rubyLog('Starting score calculation');
  
  // rubyLog('items:');
  //  rubyLog(items);
  
  // Access Ruby data if needed
  //const additionalData = JSON.parse(fetchData(options.dataId));
  const additionalData = {};
  console.log("Here")
  console.log(additionalData)
  return items.reduce((score, item) => {
    let itemScore = item.value;
    
    // Apply multipliers from options
    if (options.multiplier) {
      itemScore *= options.multiplier;
    }
    
    // Use additional data from Ruby
    if (additionalData[item.id]) {
      itemScore += additionalData[item.id].bonus;
    }
    
    return score + itemScore;
  }, 0);
}


function docAt(posn) {
  if (posn >= docs.length) {
    return {};
  } else {
    return docs[posn].doc;
  }
}

var docExistsAt = function(posn) {
  if (posn >= docs.length) {
    return false;
  }
  return true;
};

var eachDoc = function(f, count) {
  // if ( angular.isUndefined(count) ) {
  //   count = DEFAULT_NUM_DOCS;
  // }
  if (typeof variable === "undefined") {
    count = 10;
  }
  var i = 0;
  for (i = 0; i < count; i++) {
    if (docExistsAt(i)) {
      f(docAt(i), i);
    }
  }
};

var hasDocRating = function(posn) {
  return docExistsAt(posn) && hasRating(docs[posn]);
};

var hasRating = function(doc) {
  return doc.hasOwnProperty('rating');  
};
var docRating = function(posn) {
  if (docExistsAt(posn)) {
     return docs[posn]["rating"];
  }
  return undefined;
};

var theScore = null;
var setScore = function (score) {
  theScore = score;
};

var getScore = function () {
  return theScore;
};
