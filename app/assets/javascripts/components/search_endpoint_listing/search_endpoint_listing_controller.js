'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('SearchEndpointListingCtrl', [
    '$scope',
    function (
      $scope
    ) {
      var ctrl = this;
      ctrl.searchEndpoint = $scope.searchEndpoint;
      ctrl.team  = $scope.team;

      // Functions    

    }
  ]);
