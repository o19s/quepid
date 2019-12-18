'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    '$window', '$log',
    function ConfigurationSvc($window, $log) {
      var termsAndConditionsUrl;

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
