'use strict';

angular.module('QuepidSecureApp')
  .controller('SignupCtrl', [
    '$scope', '$location',
    'signupSvc',
    function ($scope, $location, signupSvc) {
      $scope.submit = function (agree, name, username, pass, confirm) {
        $scope.warnAgree    = false;
        $scope.warnEmail    = false;
        $scope.warnPass     = false;
        $scope.warnDefined  = false;
        $scope.warnErr      = false;
        $scope.warnName     = false;

        if ( !name ) {
          $scope.warnName = true;
          return;
        }

        if( !agree ) {
          $scope.warnAgree = true;
          return;
        }
        if( pass !== confirm ) {
          $scope.warnPass = true;
          return;
        }

        var emailVer = /^.+@.*$/;
        if( !emailVer.test(username) ){
          $scope.warnEmail = true;
          return;
        }

        var user = {
          username:  username,
          name:      name,
          password:  pass
        };

        signupSvc.createUser(user, function creationError() {
          $scope.warnDefined = true;
          return;
        }); //handle error - already a user
      };
    }
  ]);
