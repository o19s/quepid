'use strict';

angular.module('QuepidApp')
  .controller('TeamCtrl', [
    '$scope', '$routeParams', '$location','$uibModal',
    'teamSvc',
    function (
      $scope, $routeParams, $location,$uibModal,
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
      
      $scope.$on('updatedSearchEndpointsList', function() {
        fetchTeam(teamId);
      });
      
      
      
      $scope.unarchiveSearchEndpoint = function() {
        //$scope.currentTeam = currentTeam; // this can be null if we don't have a currentTeam
       
        $uibModal.open({
          templateUrl: 'views/unarchiveSearchEndpointModal.html',
          controller: 'UnarchiveSearchEndpointCtrl',
          resolve : {
            currentTeam: function() {
              return $scope.currentTeam;
            }
          }
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
