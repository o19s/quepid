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
      
    }
  ]);
