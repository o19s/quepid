'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    '$window', '$log',
    function ConfigurationSvc() {
      var emailMarketingMode;
      var termsAndConditionsUrl;
      var isSignupEnabled;
      var communalScorersOnly;

      this.setEmailMarketingMode = function(val) {
        emailMarketingMode = JSON.parse(val);
      };

      this.isEmailMarketingMode = function() {
        return emailMarketingMode;
      };

      this.setTermsAndConditionsUrl = function (url) {
        termsAndConditionsUrl = url;
      };

      this.hasTermsAndConditions = function () {
        if (angular.isUndefined(termsAndConditionsUrl) || termsAndConditionsUrl === ''){
          return false;
        }
        else {
          return true;
        }

      };

      this.getTermsAndConditionsUrl = function () {
        return termsAndConditionsUrl;
      };

      this.setSignupEnabled = function (val) {
        isSignupEnabled = JSON.parse(val);
      };

      this.isSignupEnabled = function() {
        return isSignupEnabled;
      };

      this.setCommunalScorersOnly = function(val) {
        communalScorersOnly = JSON.parse(val);
      };

      this.isCommunalScorersOnly = function() {
        return communalScorersOnly;
      };
    }
  ]);
