'use strict';

angular.module('QuepidSecureApp')
  .controller('LoginCtrl', [
    '$scope', '$location',
    'loginSvc',
    function ($scope, $location, loginSvc) {
      $scope.submit = function (user, pass) {
        $scope.warnDefined  = false;
        $scope.warnErr      = false;
        $scope.warnInvalid  = false;
        $scope.warnLocked   = false;

        loginSvc.login(user, pass, function(response) { // need to define an error handler
          if( response.status/1 === 404 ) {
            $scope.warnUndefined = true;
            return;
          }

          if ( response.status/1 === 400 ) {
            $scope.warnInvalid = true;
            return;
          }

          if ( response.status/1 === 422 && response.data.reason === 'LOCKED' ) {
            $scope.warnLocked = true;
            return;
          }

          $scope.warnErr = true;
        }); //handle error - already a user
      };
    }
  ]);
