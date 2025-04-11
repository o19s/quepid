'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('SearchEndpointListingCtrl', [
    '$scope','caseTryNavSvc',
    function (
      $scope, caseTryNavSvc
    ) {
      var ctrl = this;
      ctrl.searchEndpoint = $scope.searchEndpoint;
      ctrl.team  = $scope.team;
      
      $scope.createSearchEndpointLink = function(searchEndpointId) {
        let link = caseTryNavSvc.getQuepidRootUrl() + '/search_endpoints/' + searchEndpointId;
        link = caseTryNavSvc.createMainApplicationLink(link);
        return link;
      };

      // Functions    

    }
  ]);
