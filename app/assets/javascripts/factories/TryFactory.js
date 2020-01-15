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
      if ( data.searchEngine !== undefined ) {
        console.log('Data object creating Try has a searchEngine!');
        console.log(data);
      }

      if ( angular.isUndefined(data.search_engine) ) {
        console.log('We have an undefined data.search_engine so setting to Solr, should this ever happen?');
        console.log(data);
        data.search_engine = 'solr';
      }

      // Attributes
      // Note, if you are changing these, then you probably to fix the
      // var tmp = new TryFactory method in queryParams.js as well.
      self.args          = data.args;
      self.deleted       = false;
      self.escapeQuery   = data.escape_query;
      self.fieldSpec     = data.field_spec;
      self.name          = data.name;
      self.numberOfRows  = data.number_of_rows;
      self.queryParams   = data.query_params;
      self.searchEngine  = data.search_engine;
      self.searchUrl     = data.search_url;
      self.tryNo         = data.try_number;

      // transform curator vars to be more angular friendly
      var ngFriendlyCuratorVars = [];
      angular.forEach(data.curatorVars, function(varValue, varName) {
        ngFriendlyCuratorVars.push({name: varName, value: varValue});
      });

      self.curatorVars  = ngFriendlyCuratorVars;

      // Functions
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

      function rename(newName) {
        var caseNo  = caseTryNavSvc.getCaseNo();
        var nameReq = {'name': newName};

        return $http.put('/api/cases/' + caseNo + '/tries/' + self.tryNo, nameReq)
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
