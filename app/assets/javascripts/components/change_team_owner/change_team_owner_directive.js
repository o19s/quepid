'use strict';

angular.module('QuepidApp')
  .component('changeTeamOwner', {
    controller:   'ChangeTeamOwnerCtrl',
    controllerAs: 'ctrl',
    templateUrl:  'change_team_owner/change_team_owner.html',
    bindings:     {
      team: '<',
    }
  });
