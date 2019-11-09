'use strict';

angular.module('QuepidApp')
  .directive('userListing', [
    function () {
      return {
        restrict:     'E',
        controller:   'UserListingCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'user_listing/user_listing.html',
        scope:        {
          user:   '=',
          team: '=',
        },
      };
    }
  ]);
