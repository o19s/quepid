'use strict';

angular.module('QuepidApp')
  .directive('removeMember', [
    function () {
      return {
        restrict:     'E',
        controller:   'RemoveMemberCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'remove_member/remove_member.html',
        scope:        {
          thisMember: '=',
          thisTeam: '=',
        },
      };
    }
  ]);
