'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('searchEndpointSvc', [
    '$http', 'broadcastSvc',
    function searchEndpointSvc($http, broadcastSvc) {
      this.searchEndpoints = [];
      this.archived = [];

      var SearchEndpoint = function(id, name, searchEngine, endpointUrl, apiMethod, customHeaders, proxyRequests, basicAuthCredential, docsMapper) {
        this.id           = id;
        this.name         = name;
        this.searchEngine = searchEngine;
        this.endpointUrl  = endpointUrl;
        this.apiMethod    = apiMethod;
        this.customHeaders= customHeaders;
        this.proxyRequests= proxyRequests;
        this.basicAuthCredential  = basicAuthCredential;
        this.docsMapper           = docsMapper;
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
          data.docs_mapper
        );
      };

      var contains = function(list, searchEndpoint) {
        return list.filter(function(item) { return item.id === searchEndpoint.id; }).length > 0;
      };

      this.get = function(searchEndpointId) {
        // http GET /api/search_endpoints/<int:searchEndpointId>/
        var url   = `api/search_endpoints/${searchEndpointId}`;
        var self  = this;

        
        return $http.get(url)
          .then(function(response) {
            var searchEndpoint = self.constructFromData(response.data);

            return searchEndpoint;
          });
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
            
      
      this.fetchArchived = function(team) {
        var self  = this;
        self.archived = []; // reset this array

        return $http.get('api/teams/' + team.id + '/search_endpoints?archived=true')
          .then(function(response) {
            angular.forEach(response.data.search_endpoints, function(dataSearchEndpoint) {
              var searchEndpoint = self.constructFromData(dataSearchEndpoint);

              if ( !contains(self.archived, searchEndpoint) ) {
                self.archived.push(searchEndpoint);
              }
            });
          });
      };
      
      this.archiveSearchEndpoint = function(searchEndpointToArchive) {
        var self  = this;
        var searchEndpointId  = searchEndpointToArchive.id;
        var url         = 'api/search_endpoints/' + searchEndpointId;
        var data        = { archived: true };

        return $http.put(url, data)
          .then(function(response) {
            var data    = response.data;
            var searchEndpoint = self.constructFromData(data);

            // the .filter() should work, but doesn't so instead combine with a splice.
            var indexOfSearchEndpoint = self.searchEndpoints.indexOf( self.searchEndpoints.filter( function (item) {
              return item.id === searchEndpoint.id;
            })[0] );
            self.searchEndpoints.splice(indexOfSearchEndpoint, 1);
            //svc.allCases = svc.allCases.filter( function(acase) {
            //  acase.caseNo !== newCase.caseNo;
            //});
            self.archived.push(searchEndpoint);

            broadcastSvc.send('updatedSearchEndpointsList', self.searchEndpoints);
          });
      };
      
      this.unarchiveSearchEndpoint = function(searchEndpointToUnarchive) {
        var self  = this;
        var searchEndpointId  = searchEndpointToUnarchive.id;
        var url         = 'api/search_endpoints/' + searchEndpointId;
        var data        = { archived: false };

        return $http.put(url, data)
          .then(function(response) {
            var data    = response.data;
            var searchEndpoint = self.constructFromData(data);

            self.searchEndpoints.push(searchEndpoint);
            self.archived = self.archived.filter( function(aSearchEndpoint) {
              aSearchEndpoint.id !== searchEndpoint.id;
            });

            broadcastSvc.send('updatedSearchEndpointsList', self.searchEndpoints);
          });
      };      


      this.shareEndpoint = function(team, searchEndpoint) {
        // http POST api/teams/<int:teamId>/cases
        var url   = `api/teams/${team.id}/search_endpoints`;
        var data  = {
          id: searchEndpoint.id
        };

        return $http.post(url, data)
          .then(function(response) {
            team.searchEndpoints.push(response.data);
          });
      };
      
      this.deleteSearchEndpoint = function(searchEndpointToDelete) {
        var that        = this;
        var self  = this;

        return $http.delete('api/search_endpoints/' + searchEndpointToDelete.id)
          .then(function() {
            //that.refetchCaseLists();
            var indexOfSearchEndpoint = self.searchEndpoints.indexOf( self.searchEndpoints.filter( function (item) {
              return item.id === searchEndpointToDelete.id;
            })[0] );
            self.searchEndpoints.splice(indexOfSearchEndpoint, 1);            
                      
            broadcastSvc.send('updatedSearchEndpointsList', self.searchEndpoints);
           
          });
      };
      
    }
  ]);
