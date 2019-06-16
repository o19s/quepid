'use strict';

angular.module('QuepidApp')
  .directive('newCase', [
    function () {
      return {
        restrict:     'E',
        controller:   'NewCaseCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'new_case/new_case.html',
        scope:        {
          buttonText: '=',
        },
      };
    }
  ]);
