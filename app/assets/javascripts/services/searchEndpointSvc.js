'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('searchEndpointSvc', [
    '$http',
    function searchEndpointSvc($http) {
      this.searchEndpoints = [];

      var SearchEndpoint = function(id, name, searchEngine, endpointUrl, apiMethod, customHeaders, proxyRequests, basicAuthCredential, mapperCode, testQuery) {
        this.id           = id;
        this.name         = name;
        this.searchEngine = searchEngine;
        this.endpointUrl  = endpointUrl;
        this.apiMethod    = apiMethod;
        this.customHeaders= customHeaders;
        this.proxyRequests= proxyRequests;
        this.basicAuthCredential  = basicAuthCredential;
        this.mapperCode           = mapperCode;
        this.testQuery            = testQuery;
      };

      this.constructFromData = function(data) {
        return new SearchEndpoint(
          data.search_endpoint_id,
          data.name,
          data.search_engine,
          data.endpoint_url,
          data.api_method,
          data.custom_headers,
          data.proxy_requests,
          data.basic_auth_credential,
          data.mapper_code,
          data.test_query
        );
      };

      var contains = function(list, searchEndpoint) {
        return list.filter(function(item) { return item.id === searchEndpoint.id; }).length > 0;
      };

      this.list = function() {
        // http GET /api/search_endpoints
        var self  = this;

        // Clear the list just in case the data on the server changed,
        // we want to have the latest list.
        // TODO: write tests for this.
        self.searchEndpoints = [];

        return $http.get('api/search_endpoints')
          .then(function(response) {
            angular.forEach(response.data.search_endpoints, function(dataSearchEndpoint) {
              var searchEndpoint = self.constructFromData(dataSearchEndpoint);

              if(!contains(self.searchEndpoints, searchEndpoint)) {
                self.searchEndpoints.push(searchEndpoint);
              }
            });
          });
      };
      
      this.fetchForCase = function(caseNo) {
        var self  = this;
        self.searchEndpoints = [];

        return $http.get('api/cases/' + caseNo + '/search_endpoints')
          .then(function(response) {
            angular.forEach(response.data.search_endpoints, function(dataSearchEndpoint) {
              var searchEndpoint = self.constructFromData(dataSearchEndpoint);

              if(!contains(self.searchEndpoints, searchEndpoint)) {
                self.searchEndpoints.push(searchEndpoint);
              }
            });
          });
      };

      // Elasticsearch and OpenSearch share the same query DSL shape (bool/terms
      // clauses, _source template semantics). Solr, Vectara, and Algolia each have
      // their own distinct query shapes and are handled in their own branches
      // wherever this matters, so don't fold them into this check.
      this.isEsOrOsEngine = function(searchEngine) {
        return searchEngine === 'es' || searchEngine === 'os';
      };

      // Broader than isEsOrOsEngine: true for any engine whose queryParams field
      // holds a JSON document (as opposed to Solr's classic query-string params),
      // so it's the right check for "is this JSON I should validate/parse".
      this.usesJsonQueryParams = function(searchEngine) {
        return this.isEsOrOsEngine(searchEngine) || searchEngine === 'vectara' || searchEngine === 'algolia';
      };

    }
  ]);
