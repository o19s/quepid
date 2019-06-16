'use strict';

angular.module('QuepidApp')
  .filter('searchEngineName', [
    function () {
      var searchEngineName = {
        solr: 'Solr',
        es:   'Elasticsearch'
      };

      return function (input) {
        return searchEngineName[input];
      };
    }
  ]);
