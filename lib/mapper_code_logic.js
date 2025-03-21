// This file contains JavaScript logic that supports running the code mappers on the server side.  
// It is similar to https://github.com/o19s/splainer-search/blob/main/factories/searchApiSearcherFactory.js

validateMappersExist = function () {
  if (typeof numberOfResultsMapper === 'undefined') {
    throw new Error('You need to define a "numberOfResultsMapper"');
  }
  
  if (typeof docsMapper === 'undefined') {
    throw new Error('You need to define a "docsMapper"');
  }
}
