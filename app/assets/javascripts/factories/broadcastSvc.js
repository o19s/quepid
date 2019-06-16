'use strict';

angular.module('QuepidApp')
  .factory('broadcastSvc', [
    '$rootScope',
    function($rootScope) {
      return {
        send: function(msg, data) {
          $rootScope.$broadcast(msg, data);
        }
      };
    }
  ]);
