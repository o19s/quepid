'use strict';

angular.module('QuepidApp')
  .controller('ShareScorerModalInstanceCtrl', [
    '$rootScope',
    '$uibModalInstance',
    '$log',
    '$location',
    'teamSvc',
    'scorer',
    function (
      $rootScope,
      $uibModalInstance,
      $log,
      $location,
      teamSvc,
      scorer
    ) {
      var ctrl = this;

      ctrl.canUpdateScorer = false;
      ctrl.canCreateTeam = false;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.canUpdateScorer = $rootScope.currentUser.permissions.scorer.update;
          ctrl.canCreateTeam = $rootScope.currentUser.permissions.team.create;
        }
      });

      ctrl.share = {
        scorer:           scorer,
        selectedTeam:     null,
        teams:            [],
        sharedTeams:      [],
        loading:          true,
        action:           null,
        unselectedTeam:   null
      };     

      var teamHasScorer = function(team, scorerId) {
        return team.scorers.filter(function(e) {
          return e.scorerId === scorerId;
        }).length > 0;
      };

      var listDoesNotHaveTeam = function(list, team) {
        return list.filter(function(o) {
          return o.id === team.id;
        }).length === 0;
      };

      var addTeamToLists = function(team) {
        // Check if this scorer has been shared with this team before, ie. the
        // scorer is in the team object's scorers array.
        // If yes, add it to the shared array, otherwise add it to the main array.
        if (teamHasScorer(team, ctrl.share.scorer.scorerId)) {
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

      teamSvc.list()
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
