// this is demo code.
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

// return the ratings as an array from the top-N (count) documents stored in Quepid for a query
// works globally, not restricted to just search engine results, could be ratings generated via
// the 'Missing Documents' modal UI.
function getBestRatings(count, bestDocs) {
  //instead of x.rating use x["rating"]
  
  var bestDocsRatings = bestDocs.slice(0, count).map(function(x) {return x['rating'];});

  return bestDocsRatings;
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

var ratedDocAt = function(posn) {
  if (posn >= query.ratedDocs.length) {
    return {};
  } else {
    return query.ratedDocs[posn];
  }
};

var ratedDocExistsAt = function(posn) {
  if (posn >= query.ratedDocs.length) {
    return false;
  }
  return true;
};

/*jshint unused:false */
var hasDocRating = function(posn) {
  return docExistsAt(posn) && docs[posn].hasRating();
};

var docRating = function(posn) {
  if (docExistsAt(posn)) {
     // return docs[posn].getRating(); // ScorerFactory.js version
     return docs[posn]["rating"];
  }
  return undefined;
};

var numFound = function() {
  return total;
};

var numReturned = function() {
  return docs.length;
};

var avgRating = function(count) {
  return baseAvg(docs, count);
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

var eachRatedDoc = function(f, count) {
  // if ( angular.isUndefined(count) ) {
  //   count = DEFAULT_NUM_DOCS;
  // }
  if (typeof variable === "undefined") {
    count = 10;
  }

  var i = 0;
  for (i = 0; i < count; i++) {
    if (ratedDocExistsAt(i)) {
      f(ratedDocAt(i), i);
    }
  }
};

// Loops through all docs that have been rated, and calls
// the callback function on each doc.
// Even those that are not in the top 10 current.
//
// @param f, Callback
var eachDocWithRating = function(f) {
  var i = 0;
  for (i = 0; i < bestDocs.length; i++) {
    f(bestDocs[i]);
  }
};

var topRatings = function(count) {
  return getBestRatings(count, bestDocs);
};

var hasDocRating = function(posn) {
  return docExistsAt(posn) && hasRating(docs[posn]);
};

var qOption = function(key) {
  if ( options !== undefined && options !== null && options.hasOwnProperty(key) ) {
    return options[key];
  } else {
    return null;
  }
};

// Not in ScorerFactory.js
var hasRating = function(doc) {
  return doc.hasOwnProperty('rating');  
};

var theScore = null;
var setScore = function (score) {
  theScore = score;
};

var getScore = function () {
  return theScore;
};
