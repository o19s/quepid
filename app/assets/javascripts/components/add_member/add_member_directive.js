'use strict';

angular.module('QuepidApp')
  .directive('addMember', [
    function () {
      return {
        restrict:     'E',
        controller:   'AddMemberCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'add_member/add_member.html',
        scope:        {
          team: '=',
        },
      };
    }
  ]);
