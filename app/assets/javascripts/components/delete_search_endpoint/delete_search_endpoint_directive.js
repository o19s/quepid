'use strict';

angular.module('QuepidApp')
  .directive('deleteSearchEndpoint', [
    function () {
      return {
        restrict:     'E',
        controller:   'DeleteSearchEndpointCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'delete_search_endpoint/delete_search_endpoint.html',
        scope:        {
          thisSearchEndpoint: '=',
        },
      };
    }
  ]);
