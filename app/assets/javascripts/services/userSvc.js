'use strict';

angular.module('UtilitiesModule')
  .service('userSvc', [
    '$http',
    function userSvc($http) {
      this.triggerWizard = false;

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
        self.firstLogin      = userObj.firstLogin;
        self.id              = userObj.id;
        self.permissions     = userObj.permissions;
        self.email           = userObj.email;

        var maxQueries = userObj.maxQueries;
        var numQueries = userObj.numQueries;
        self.introWizardSeen = userObj.introWizardSeen;

        this.hasReachedQueryLimit = function () {
          return (this.queriesRemaining() === 0);
        };

        this.queriesRemaining = function() {
          if (maxQueries === 'infinity') {
            return 9999999999999999;
          }
          return (maxQueries/1) - (numQueries/1);
        };

        this.queryRemoved = function() {
          numQueries--;
        };

        this.queryAdded = function(count) {
          if ( angular.isUndefined(count) || count === null ) {
            numQueries++;
          } else {
            numQueries += count;
          }
        };

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
          var url   = '/api/users/' + self.id;
          var data  = {
            user: {
              first_login: false
            }
          };

          return $http.put(url, data)
            .then( function() {
              self.introWizardSeen  = true;
              self.firstLogin       = false;

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
