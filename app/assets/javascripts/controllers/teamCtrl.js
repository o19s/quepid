'use strict';

angular.module('QuepidApp')
  .controller('TeamCtrl', [
    '$scope', '$routeParams', '$location',
    'teamSvc',
    function (
      $scope, $routeParams, $location,
      teamSvc
    ) {
      var ctrl = this;

      $scope.teamModel   = {};
      var teamId         = parseInt($routeParams.teamId, 10);
      $scope.currentTeam = {};

      // Functions
      ctrl.fetchTeam = fetchTeam;

      $scope.$on('teamUpdated', function(event, team) {
        $scope.currentTeam = team;
      });

      $scope.teamModel.show = function(teamId) {
        fetchTeam(teamId);
      };

      $scope.$on('updatedCasesList', function() {
        fetchTeam(teamId);
      });

      var init = function() {
        if (teamId) {
          $scope.teamModel.show(teamId);
        }
      };

      function fetchTeam (teamId) {
        teamSvc.get(teamId, true)
          .then(function(response) {
            $scope.currentTeam = response;
          }, function() {
            $location.path('/teams');
          });
      }

      init();
    }
  ]);
