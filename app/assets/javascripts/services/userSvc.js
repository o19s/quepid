'use strict';

angular.module('UtilitiesModule')
  .service('userSvc', [
    '$http',
    function userSvc($http) {
      var currUser = null;

      var User = function(userObj) {
        var self = this;

        self.company         = userObj.company;
        self.defaultScorerId = userObj.default_scorer_id;
        self.completedCaseWizard      = userObj.completed_case_wizard;
        self.id              = userObj.id;
        self.administrator   = userObj.administrator;
        self.email           = userObj.email;
        self.ai_judge        = userObj.ai_judge;
        self.casesInvolvedWithCount   = userObj.cases_involved_with_count;
        self.teamsInvolvedWithCount   = userObj.teams_involved_with_count;

        this.shownIntroWizard = function() {
          var self  = this;
          self.introWizardSeen=true;
          var url   = 'api/users/' + self.id;
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
          var url   = 'api/users/' + self.id;
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

      this.get = function(id) {
        var url     = 'api/users/' + id;

        return $http.get(url)
          .then(function(response) {
            return new User(response.data);
          });
      };

      this.getCurrentUser = function() {
        var url     = 'api/users/current';
        var self    = this;

        return $http.get(url)
          .then(function(response) {
            self.bootstrapUser(response.data);
            return self.getUser();
          });
      };
    }
  ]);
