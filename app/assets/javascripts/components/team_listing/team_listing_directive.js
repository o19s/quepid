'use strict';

angular.module('QuepidApp')
  .directive('teamListing', [
    function () {
      return {
        restrict:     'E',
        controller:   'TeamListingCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'team_listing/team_listing.html',
        scope:         {
          team: '=',
        },
      };
    }
  ]);
