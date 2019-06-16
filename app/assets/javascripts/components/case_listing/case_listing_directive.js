'use strict';

angular.module('QuepidApp')
  .directive('caseListing', [
    function () {
      return {
        restrict:     'E',
        controller:   'CaseListingCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'case_listing/case_listing.html',
        scope:        {
          thisCase: '=',
        },
      };
    }
  ]);
