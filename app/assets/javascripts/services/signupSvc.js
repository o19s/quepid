'use strict';

// When your user needs to log in.
angular.module('QuepidSecureApp')
  .service('signupSvc', [
    '$location', '$http',
    'loginSvc',
    function signupSvc($location, $http, loginSvc) {
      var self = this;

      this.signupSuccess = function(username, password) {
        return function() {
          loginSvc.login(username, password);
        };
      };

      this.createUser = function(user, errorHandler) {
        if(!errorHandler) {
          errorHandler = function() {};
        }

        user.agree = true;

        var user_params = {
          user: user
        };

        $http.post('/api/signups', user_params)
          .then(
            self.signupSuccess(user.username, user.password),
            errorHandler
          );
      };
    }
  ]);
