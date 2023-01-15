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
      $scope.casesScope               = {};
      $scope.casesScope.typeFilter    = 'all';

      // Functions
      function fetchTeam (teamId) {
        teamSvc.get(teamId, true)
          .then(function(response) {
            $scope.currentTeam = response;
          }, function() {
            $location.path('/teams');
          });
      }

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

      init();
    }
  ]);
