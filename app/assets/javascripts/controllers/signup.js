'use strict';

angular.module('QuepidSecureApp')
  .controller('SignupCtrl', [
    '$scope', '$location',
    'signupSvc',
    'configurationSvc',
    function ($scope, $location, signupSvc, configurationSvc) {
      $scope.hasTermsAndConditions = configurationSvc.hasTermsAndConditions();
      if (configurationSvc.hasTermsAndConditions()){
        $scope.termsAndConditionsUrl = configurationSvc.getTermsAndConditionsUrl();
      }

      $scope.isEmailMarketingMode = configurationSvc.isEmailMarketingMode();
      $scope.isSignupEnabled = configurationSvc.isSignupEnabled();

      $scope.submit = function (agree, emailMarketingAgree, name, email, pass, confirm) {
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

        if( $scope.hasTermsAndConditions && !agree ) {
          $scope.warnAgree = true;
          return;
        }
        if( pass !== confirm ) {
          $scope.warnPass = true;
          return;
        }

        var emailVer = /^[a-z]+[a-z0-9._]+@[a-z]+\.[a-z.]{2,5}$/;
        if( !emailVer.test(email) ){
          $scope.warnEmail = true;
          return;
        }

        var user = {
          email:        email,
          name:            name,
          password:        pass,
          email_marketing: emailMarketingAgree
        };

        signupSvc.createUser(user, function creationError() {
          $scope.warnDefined = true;
          return;
        }); //handle error - already a user
      };
    }
  ]);
