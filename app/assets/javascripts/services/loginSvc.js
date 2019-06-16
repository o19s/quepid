'use strict';

// When your user needs to log in.
angular.module('QuepidSecureApp')
  .service('loginSvc', [
    '$window', '$http',
    'secureRedirectSvc',
    function loginSvc($window, $http, secureRedirectSvc) {
      this.login = function(username, password, errorHandler, nextUrl) {
        if(!errorHandler) {
          errorHandler = function(){};
        }

        $http.post('/users/login', {'username':username, 'password':password})
          .then( function() {
            secureRedirectSvc.redirectToMain(nextUrl);
          }, errorHandler);
      };
    }
  ]);
