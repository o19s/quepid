'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    '$window', '$log',
    function ConfigurationSvc() {
      var gdprMode;
      var termsAndConditionsUrl;

      this.setGdprMode = function(val) {
        gdprMode = JSON.parse(val);
      };

      this.isGdprMode = function() {
        return gdprMode;
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
    }
  ]);
