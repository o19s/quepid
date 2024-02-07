'use strict';

angular.module('QuepidApp')
  .filter('searchEngineName', [
    function () {
      const searchEngineName = {
        solr: 'Solr',
        es:   'Elasticsearch',
        os:   'OpenSearch',
        vectara: 'Vectara',
        algolia: 'Algolia',
        static: 'Static File',
        searchapi: 'Search API'
      };

      return function (input) {
        if (searchEngineName[input]){
          return searchEngineName[input];
        }
        else {
          return input;
        }
      };
    }
  ]);
