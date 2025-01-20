'use strict';

angular.module('QuepidApp')
  .controller('ShareCaseModalInstanceCtrl', [
    '$rootScope',
    '$scope',
    '$uibModalInstance',
    '$log',
    '$location',
    'teamSvc',
    'acase',
    function (
      $rootScope,
      $scope,
      $uibModalInstance,
      $log,
      $location,
      teamSvc,
      acase
     ) {
      var ctrl = this;

      ctrl.share = {
        acase:            acase,
        selectedTeam:     null,
        teams:            [],
        sharedTeams:      [],
        loading:          true,
        action:           null,
        unselectedTeam:   null
      };

      var teamHasCase = function(team, caseNo) {
        return team.cases.filter(function(e) {
          return e.caseNo === caseNo;
        }).length > 0;
      };

      var listDoesNotHaveTeam = function(list, team) {
        return list.filter(function(o) {
          return o.id === team.id;
        }).length === 0;
      };

      var addTeamToLists = function(team) {
        // Check if this case has been shared with this team before, ie. the
        // case is in the team object's cases array.
        // If yes, add it to the shared array, otherwise add it to the main array.
        if (teamHasCase(team, ctrl.share.acase.caseNo)) {
          // Only add the team if it hasn't been added before.
          if (listDoesNotHaveTeam(ctrl.share.sharedTeams, team)) {
            ctrl.share.sharedTeams.push(team);
          }
        } else {
          // Only add the team if it hasn't been added before.
          if (listDoesNotHaveTeam(ctrl.share.teams, team)) {
            ctrl.share.teams.push(team);
          }
        }
      };

      teamSvc.list(true)
        .then(function() {
          angular.forEach(teamSvc.teams, function(team) {
            addTeamToLists(team);
          });

          ctrl.share.loading = false;
        }, function(response) {
          $log.debug(response.data);
        });

      ctrl.selectTeam = function(selectedTeam) {
        ctrl.share.selectedTeam = selectedTeam;
        ctrl.share.unselectedTeam = null;
        ctrl.share.action = 'select';
      };
      ctrl.unselectTeam = function(selectedTeam) {
        ctrl.share.selectedTeam = null;
        ctrl.share.unselectedTeam = selectedTeam;
        ctrl.share.action = 'unselect';
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.share);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.goToTeamsPage = function () {
        $uibModalInstance.dismiss('cancel');
        $location.path('/teams');
      };
    }
  ]);
