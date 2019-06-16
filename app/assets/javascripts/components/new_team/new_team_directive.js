'use strict';

angular.module('QuepidApp')
  .directive('newTeam', [
    function () {
      return {
        restrict:     'E',
        controller:   'NewTeamCtrl',
        controllerAs: 'ctrl',
        templateUrl:  'new_team/new_team.html',
        scope:        {
          buttonText: '=',
        },
      };
    }
  ]);
