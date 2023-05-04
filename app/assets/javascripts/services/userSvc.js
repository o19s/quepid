'use strict';

angular.module('UtilitiesModule')
  .service('userSvc', [
    '$http',
    'configurationSvc',
    function userSvc($http, cfg) {
      var currUser = null;

      var User = function(userObj) {
        var self = this;

        self.company         = userObj.company;
        self.defaultScorerId = userObj.default_scorer_id;
        self.completedCaseWizard      = userObj.completed_case_wizard;
        self.id              = userObj.id;
        self.permissions     = userObj.permissions;
        self.email           = userObj.email;
        self.casesInvolvedWithCount   = userObj.cases_involved_with_count;
        self.teamsInvolvedWithCount   = userObj.teams_involved_with_count;

        this.shownIntroWizard = function() {
          var self  = this;
          self.introWizardSeen=true;
          var url   = cfg.getApiPath() + 'users/' + self.id;
          var data  = {
            user: {
              completed_case_wizard: true
            }
          };

          return $http.put(url, data)
            .then( function() {
              self.completedCaseWizard       = true;

              return self;
            });
        };

        this.updateUserScorer = function(defaultScorerId) {
          var self  = this;
          var url   = cfg.getApiPath() + 'users/' + self.id;
          var data  = {
            user: {
              default_scorer_id: defaultScorerId
            }
          };

          return $http.put(url, data)
            .then( function() {
              self.defaultScorerId = defaultScorerId;

              return self;
            });
        };
      };

      this.bootstrapUser = function(userData) {
        currUser = new User(userData);
      };

      this.getUser = function() {
        return currUser;
      };

      this.users = function(prefix) {
        var url     = cfg.getApiPath() + 'users';
        var params  = { prefix: prefix };

        return $http.get(url, { params: params });
      };

      this.get = function(id) {
        var url     = cfg.getApiPath() + 'users/' + id;

        return $http.get(url)
          .then(function(response) {
            return new User(response.data);
          });
      };

      this.getCurrentUser = function() {
        var url     = cfg.getApiPath() + 'users/current';
        var self    = this;

        return $http.get(url)
          .then(function(response) {
            self.bootstrapUser(response.data);
            return self.getUser();
          });
      };
    }
  ]);
