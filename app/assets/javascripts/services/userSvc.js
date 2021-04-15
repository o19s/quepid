'use strict';

angular.module('UtilitiesModule')
  .service('userSvc', [
    '$http',
    function userSvc($http) {
      var currUser = null;

      var User = function(userObj) {
        var self = this;

        // Make sure the user's scorerId is an int instead of a string.
        // In the advanced screen, the dropdown lists the scorers' id as a number
        // so the comparison fails if the user's scorerId is a string, and
        // even if the user has a default scorer it would look like as
        // if he does not.
        var defaultScorerId;
        if ( !isNaN(parseInt(userObj.defaultScorerId)) ) {
          defaultScorerId = parseInt(userObj.defaultScorerId);
        }

        self.company         = userObj.company;
        self.defaultScorerId = defaultScorerId;
        self.completedCaseWizard      = userObj.completed_case_wizard;
        self.id              = userObj.id;
        self.permissions     = userObj.permissions;
        self.email           = userObj.email;
        self.casesInvolvedWithCount   = userObj.cases_involved_with_count;
        self.teamsInvolvedWithCount   = userObj.teams_involved_with_count;

        this.updatePassword = function(oldPass, newPass, success, failure) {
          $http.post('/api/users/' + self.id, {
            oldPassword:oldPass,
            newPassword:newPass
          })
          .then(
            success || function(){},
            failure || function(){}
          );
        };

        this.shownIntroWizard = function() {
          var self  = this;
          self.introWizardSeen=true;
          var url   = '/api/users/' + self.id;
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
          var url   = '/api/users/' + self.id;
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
        var url     = '/api/users';
        var params  = { prefix: prefix };

        return $http.get(url, { params: params });
      };

      this.get = function(id) {
        var url     = '/api/users/' + id;

        return $http.get(url)
          .then(function(response) {
            return new User(response.data);
          });
      };

      this.getCurrentUser = function() {
        var url     = '/api/users/current';
        var self    = this;

        return $http.get(url)
          .then(function(response) {
            self.bootstrapUser(response.data);
            return self.getUser();
          });
      };
    }
  ]);
