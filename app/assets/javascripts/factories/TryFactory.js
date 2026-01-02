'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('TryFactory', [
      '$http',
      'fieldSpecSvc', 'caseTryNavSvc','varExtractorSvc',
      TryFactory
    ]);

  function TryFactory(
    $http,
    fieldSpecSvc, caseTryNavSvc, varExtractorSvc
  ) {
    var Try = function(data) {
      // This method converts the response from the API to angular objects.
      var self  = this;

      if ( data.query_params === null ) {
        // this app
        if (data.search_engine === 'solr'){
          data.query_params = '';
        }
        else {
          data.query_params = '{}';
        }
      }


      // Attribute mapping from snake to camel case.
      // don't forget the reverse mapping in toApiFormat() method below.
      self.args          = data.args;
      self.deleted       = false;
      self.escapeQuery   = data.escape_query;
      self.apiMethod     = data.api_method;
      self.customHeaders = data.custom_headers;
      self.fieldSpec     = data.field_spec;
      self.name          = data.name;
      self.numberOfRows  = data.number_of_rows;
      self.queryParams   = data.query_params;
      self.searchEngine  = data.search_engine;
      self.searchEndpointId = data.search_endpoint_id;
      self.endpointName  = data.endpoint_name;
      self.searchUrl     = data.search_url;
      self.tryNo         = data.try_number;
      self.endpointName  = data.endpoint_name;       
      self.basicAuthCredential  = data.basic_auth_credential;    
      self.mapperCode    = data.mapper_code;
      self.proxyRequests = data.proxy_requests;
      self.options       = data.options;
      self.endpointArchived = data.endpoint_archived;
      self.requestsPerMinute = data.requests_per_minute;


      // transform curator vars to be more angular friendly
      var ngFriendlyCuratorVars = [];
      angular.forEach(data.curator_vars, function(varValue, varName) {
        ngFriendlyCuratorVars.push({name: varName, value: varValue});
      });

      self.curatorVars  = ngFriendlyCuratorVars;

      // Functions
      self.formattedName   = formattedName;
      self.createFieldSpec = createFieldSpec;
      self.curatorVarsDict = curatorVarsDict;
      self.hasVar          = hasVar;
      self.getVar          = getVar;
      self.rename          = rename;
      self.sortVars        = sortVars;
      self.addVar          = addVar;
      self.updateVars      = updateVars;
      self.forEachVar      = forEachVar;
      self.toApiFormat     = toApiFormat;

      // Bootstrap
      self.updateVars();

      function formattedName() {
        if (self.name.includes('Try ' + self.tryNo)){
          return self.name;
        }
        else {
          return self.name + ' - Try ' + self.tryNo;
        }
      }

      // Create a field spec from the string I'm
      // carrying around that stores that info
      function createFieldSpec() {
        return fieldSpecSvc.createFieldSpec(self.fieldSpec);
      }

      // what the backend API understands
      function curatorVarsDict() {
        var backendCv = {};
        angular.forEach(self.curatorVars, function(curatorVar) {
          backendCv[curatorVar.name] = curatorVar.value;
        });
        return backendCv;
      }

      function hasVar(varName) {
        // not terribly efficient, but there shouldn't be more than a handful
        var cvDict = self.curatorVarsDict();
        return cvDict.hasOwnProperty(varName);
      }

      function getVar(varName) {
        var rVal = false;

        self.forEachVar(function(varObj) {
          if (!rVal && varObj.name === varName) {
            rVal = varObj;
          }
        });

        return rVal;
      }

      // This method overlaps with settingsSvc.js update() method in
      // terms of interacting with a Try.
      function rename(newName) {
        var caseNo  = caseTryNavSvc.getCaseNo();
        var nameReq = {'name': newName};

        return $http.put('api/cases/' + caseNo + '/tries/' + self.tryNo, nameReq)
          .then(function() {
            self.name = newName;
          });
      }

      function sortVars() {
        // sort on name
        self.curatorVars.sort(function(a, b) {
          return a.name.localeCompare(b.name);
        });
      }

      function addVar(aTry, varName, initialValue) {
        if (!aTry.hasVar(varName)) {
          aTry.curatorVars.push({name: varName, value: initialValue});
        }
      }

      // Update the curator vars by parsing the query string
      function updateVars() {
        self.forEachVar(function(curatorVar) {
          curatorVar.inQueryParams = false;
        });

        var varNames = varExtractorSvc.extract(self.queryParams);
        angular.forEach(varNames, function(varName) {
          var foundVar = self.getVar(varName);
          if (!foundVar) {
            addVar(self, varName, 10);
            var newVar = self.getVar(varName);
            newVar.inQueryParams = true;
          }
          else {
            foundVar.inQueryParams = true;
          }
        });
        sortVars();
      }

      function forEachVar(innerBodyFn) {
        angular.forEach(self.curatorVars, innerBodyFn);
      }

      // Convert back to API format (snake_case) for creating new TryFactory instances
      function toApiFormat() {
        return {
          args:                  self.args,
          curator_vars:          self.curatorVarsDict(),
          escape_query:          self.escapeQuery,
          api_method:            self.apiMethod,
          custom_headers:        self.customHeaders,
          field_spec:            self.fieldSpec,
          name:                  self.name,
          number_of_rows:        self.numberOfRows,
          query_params:          self.queryParams,
          search_endpoint_id:    self.searchEndpointId,
          endpoint_name:         self.endpointName,
          search_engine:         self.searchEngine,
          search_url:            self.searchUrl,
          try_number:            self.tryNo,
          basic_auth_credential: self.basicAuthCredential,
          mapper_code:           self.mapperCode,
          proxy_requests:        self.proxyRequests,
          options:               self.options,
          endpoint_archived:     self.endpointArchived,
          requests_per_minute:   self.requestsPerMinute,
        };
      }
    };

    // Return factory object
    return Try;
  }
})();
