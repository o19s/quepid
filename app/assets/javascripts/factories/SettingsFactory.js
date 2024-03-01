'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('SettingsFactory', [
      '$http',
      '$q',
      'settingsIdValue',
      'caseTryNavSvc',
      'TryFactory',
      SettingsFactory
    ]);

  function SettingsFactory(
    $http,
    $q,
    settingsIdValue,
    caseTryNavSvc,
    TryFactory
  ) {
    var Settings = function(tryList) {
      var self = this;
      var Try  = TryFactory;

      self.tries        = [];
      self.selectedTry  = null;

      // a unique identifier for this setting,
      // increments on a succesful submit of cloned settings
      self.settingsId = settingsIdValue.id++;

      // Functions
      self.getTry          = getTry;
      self.selectTry       = selectTry;
      self.numTries        = numTries;
      self.lastTry         = lastTry;
      self.renameTry       = renameTry;
      self.deleteTry       = deleteTry;
      self.duplicateTry    = duplicateTry;
      self.createFieldSpec = createFieldSpec;
      self.findTry         = findTry;
      self.addTries        = addTries;
      self.addTry          = addTry;

      // Bootstrap
      self.addTries(tryList);

      function getTry(tryNo) {
        var rVal = null;

        angular.forEach(self.tries, function(aTry) {
          if (aTry !== undefined && aTry.tryNo === tryNo) {
            rVal = aTry;
          }
        });

        return rVal;
      }

      // Set the selected try for these settings
      function selectTry(tryNo) {
        self.selectedTry = self.getTry(tryNo);
      }

      function numTries() {
        var numTries = 0;
        for (var i = self.tries.length - 1; i > -1; --i) {
          if (!self.tries[i].deleted) {
            numTries++;
          }
        }
        return numTries;
      }

      function lastTry() {
        for (var i = self.tries.length - 1; i > -1; --i) {
          if (!self.tries[i].deleted) {
            return self.tries[i];
          }
        }
        return null;
      }

      function renameTry(tryNo, newName) {
        var promises = [];
        var matching = self.tries.filter(function(t) {
          return tryNo === t.tryNo;
        });

        if ( angular.isUndefined(matching) || matching.length === 0 ) {
          return $q(function(resolve) {
            resolve();
          });
        }

        angular.forEach(matching, function(theTry) {
          promises.push(theTry.rename(newName));
        });

        return $q.all(promises)
          .then(function() {
            angular.forEach(matching, function() {
              matching.name = newName;
              self.settingsId++;
            });
          });
      }

      function deleteTry(tryNo) {
        var caseNo    = caseTryNavSvc.getCaseNo();

        if (self.numTries() <= 1) {
          return $q(function(resolve) {
            resolve();
          });
        }

        var theTry = self.tries.filter(function(t) { return t.tryNo === tryNo; })[0];

        if ( angular.isUndefined(theTry) ) {
          return $q(function(resolve) {
            resolve();
          });
        }

        var index = self.tries.indexOf(theTry);
        return $http.delete('api/cases/' + caseNo + '/tries/' + tryNo)
          .then(function() {
            self.settingsId               = settingsIdValue.id++;
            self.tries[index].deleted  = true;

            if (self.tries[index].tryNo === self.selectedTry.tryNo) {
              var lastTry = self.lastTry();
              caseTryNavSvc.navigateTo({tryNo: lastTry.tryNo});
            }
          });
      }

      function duplicateTry(tryNo) {
        var caseNo  = caseTryNavSvc.getCaseNo();
        var url     = 'api/clone/cases/' + caseNo + '/tries/' + tryNo;

        return $http.post(url)
          .then(function(response) {
            var jsonTry = response.data;
            var theTry  = new Try(jsonTry);

            self.tries.unshift(theTry);
            self.settingsId++;

            return theTry;
          });
      }

      // Create a field spec from the string I'm
      // carrying around that stores that info
      function createFieldSpec() {
        return self.selectedTry.createFieldSpec();
      }

      // find the try corresponding to the passed in
      // queryParams
      function findTry(qp) {
        var foundTry = null;

        angular.forEach(self.tries, function(aTry) {
          if (foundTry === null) {
            if (aTry.queryParams === qp.queryParams &&
                angular.equals(aTry.curatorVarsDict(),qp.curatorVars)
            ) {
              foundTry = aTry;
            }
          }
        });

        return foundTry;
      }

      function addTries(tryList) {
        self.tries.length = 0;

        angular.forEach(tryList, function(tryJson) {
          self.addTry(tryJson);
        });
      }

      function addTry(tryJson) {
        var newTry = new Try(tryJson);
        self.tries.push(newTry);

        return newTry;
      }
    };

    // Return factory object
    return Settings;
  }
})();
