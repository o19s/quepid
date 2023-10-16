'use strict';

angular.module('QuepidApp')
  .directive('searchEndpointListing', [
    function () {
      return {
        restrict:     'E',
        controller:   'SearchEndpointListingCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'search_endpoint_listing/search_endpoint_listing.html',
        scope:        {
          searchEndpoint: '=',
          team:   '=',
        },
      };
    }
  ]);
