'use strict';

window.parseUrlParams = function(queryString) {
  if (queryString[0] === '?') {
    queryString = queryString.slice(1, queryString.length);
  }
  var queryParams = queryString.split('&');
  var parsedParams = {};
  angular.forEach(queryParams, function(queryParam) {
    var qpSplit = queryParam.split('=');
    var param = qpSplit[0];
    var value = qpSplit[1];
    if (!parsedParams.hasOwnProperty(param)) {
      parsedParams[param] = [];
    }
    parsedParams[param].push(value);
  });
  return parsedParams;
};

window.arrayContains = function(list, value) {
  var contains = false;
  angular.forEach(list, function(listValue) {
    if (listValue === value) {
      contains = true;
    }
  });
  return contains;
};

window.urlContainsParams = function(url, params) {
  return {
    test: function(requestedUrl) {
      if (requestedUrl.indexOf(url) !== 0) {
        return false;
      }
      var missingParam = false;
      var urlEncodedArgs = requestedUrl.substr(url.length);
      var parsedParams = parseUrlParams(urlEncodedArgs);
      angular.forEach(params, function(values, param) {
        if (values instanceof Array) {
          angular.forEach(values, function(value) {
            if (!arrayContains(parsedParams[param], value)) {
              missingParam = true;
            }
          });
        } else {
          missingParam = true;
        }
      });
      return !missingParam;
    }
  };
};

window.mockSolrUrl =  "http://example.com:1234/solr/example";

window.expectedSolrUrl = function(expected) {
  return {
    test: function(url) {
      if (expected === undefined) {
        expected = window.mockSolrUrl;
      }
      return url.indexOf(expected) === 0;
    }
  };
};

window.mockFullQueriesResp = {
  queries: {
    displayOrder: [2,1,0],
    queries: {
      '0': {
        'arrangedAt': '3681400536',
        'arrangedNext': '4294967295',
        'deleted': 'false',
        'queryId': '0',
        'query_text': 'symptoms of heart attack',
        'doc1': '5',
        'doc2': '9'
      },
      '1': {
        'arrangedAt': '3067833780',
        'arrangedNext': '3681400536',
        'deleted': 'true',
        'queryId': '1',
        'query_text': 'how is kidney cancer diagnosed'
      },
      '2': {
        'arrangedAt': '0',
        'arrangedNext': '613566756',
        'deleted': 'false',
        'l_31284': '10',
        'queryId': '2',
        'query_text': 'prognosis of alzheimers',
        'doc1': '1',
        'doc2': '10'
      }
    }
  }
};
window.mockResults = {
  response: {
    numFound: 2,
    docs : [
      {id: 'doc1', field1: 'doc1field1val', field2: 'doc1field2val'},
      {id: 'doc2', field1: 'doc2field1val', field2: 'doc2field2val'}
    ]
  }
};
