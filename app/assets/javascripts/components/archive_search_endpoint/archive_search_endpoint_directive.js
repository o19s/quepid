'use strict';

angular.module('QuepidApp')
  .directive('archiveSearchEndpoint', [
    function () {
      return {
        restrict:     'E',
        controller:   'ArchiveSearchEndpointCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'archive_search_endpoint/archive_search_endpoint.html',
        scope:        {
          thisSearchEndpoint: '=',
        },
        bindings:     {
          thisSearchEndpoint: '<',
        }
      };
    }
  ]);
