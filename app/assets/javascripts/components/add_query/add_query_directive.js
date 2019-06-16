'use strict';

angular.module('QuepidApp')
  .directive('addQuery', [
    function() {
      return {
        scope:          true,
        controller:     'AddQueryCtrl',
        controllerAs:   'ctrl',
        templateUrl:    'add_query/add_query.html',
      };
    }
  ]);
