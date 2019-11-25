'use strict';

angular.module('QuepidApp')
  .directive('scorerListing', [
    function () {
      return {
        restrict:     'E',
        controller:   'ScorerListingCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'scorer_listing/scorer_listing.html',
        scope:        {
          scorer: '=',
          team:   '=',
        },
      };
    }
  ]);
