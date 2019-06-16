'use strict';

angular.module('QuepidApp')
  .controller('TeamCtrl', [
    '$scope', '$routeParams', '$location',
    'teamSvc',
    function (
      $scope, $routeParams, $location,
      teamSvc
    ) {
      $scope.teamModel   = {};
      var teamId         = parseInt($routeParams.teamId, 10);
      $scope.currentTeam = {};

      $scope.$on('teamUpdated', function(event, team) {
        $scope.currentTeam = team;
      });

      $scope.teamModel.show = function(teamId) {
        teamSvc.get(teamId, true)
          .then(function(response) {
            $scope.currentTeam = response;
          }, function() {
            $location.path('/teams');
          });
      };

      var init = function() {
        if (teamId) {
          $scope.teamModel.show(teamId);
        }
      };

      init();
    }
  ]);
