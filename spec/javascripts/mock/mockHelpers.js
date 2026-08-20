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

window.expectedSolrUrl = function(expected) {
  return {
    test: function(url) {
      return url.indexOf(expected) === 0;
    }
  };
};

// Compiles `html` against `scope` and runs a digest so directive link
// functions have run by the time the caller inspects the result. Shared by
// the quepidPopover/quepidTooltip/quepidCollapse/quepidSortable specs.
window.compileDirective = function($compile, scope, html) {
  var element = $compile(html)(scope);
  scope.$digest();
  return element;
};
