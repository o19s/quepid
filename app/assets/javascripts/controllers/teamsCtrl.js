'use strict';

angular.module('QuepidApp')
  .controller('TeamsCtrl', [
    '$scope',
    'flash',
    'teamSvc',
    function ($scope, flash, teamSvc) {
      $scope.teamsScope             = {};
      $scope.teamsScope.teams       = [];
      $scope.teamsScope.typeFilter  = 'all';

      $scope.pagination = {
        teams: {
          currentPage:  1,
          pageSize:     10
        }
      };

      $scope.loading = true;
      teamSvc.list()
        .then(function() {
          $scope.teamsScope.teams = teamSvc.teams;
          $scope.loading = false;
        }, function(response) {
          flash.error = response.data.message;
          $scope.loading = false;
        });
    }
  ]);
