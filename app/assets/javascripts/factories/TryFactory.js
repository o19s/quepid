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

      // check if the backend has populated these fields or not?
      //if ( angular.isUndefined(data.search_engine) ) {
      //  data.search_engine = 'solr';
      //}

      if ( data.query_params === null ) {
        // this app
        if (data.search_engine === 'solr'){
          data.query_params = '';
        }
        else {
          data.query_params = '{}';
        }
      }


      // Attributes
      // Note, if you are changing these, then you probably to fix the
      // var tmp = new TryFactory method in queryParams.js as well.
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
      self.snapshotId    = data.snapshot_id;


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
    };

    // Return factory object
    return Try;
  }
})();
