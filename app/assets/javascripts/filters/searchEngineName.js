'use strict';

angular.module('QuepidApp')
  .filter('searchEngineName', [
    function () {
      var searchEngineName = {
        solr: 'Solr',
        es:   'Elasticsearch',
        os:   'OpenSearch',
        vectara: 'Vectara',
        static: 'Static File'
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
