'use strict';

angular.module('QuepidApp')
  .directive('deleteCase', [
    function () {
      return {
        restrict:     'E',
        controller:   'DeleteCaseCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'delete_case/delete_case.html',
        scope:        {
          thisCase: '=',
        },
      };
    }
  ]);
