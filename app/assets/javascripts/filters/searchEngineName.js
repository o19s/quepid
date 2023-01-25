'use strict';

angular.module('QuepidApp')
  .filter('searchEngineName', [
    function () {
      var searchEngineName = {
        solr: 'Solr',
        es:   'Elasticsearch',
        os:   'OpenSearch'
      };

      return function (input) {
        return searchEngineName[input];
      };
    }
  ]);
