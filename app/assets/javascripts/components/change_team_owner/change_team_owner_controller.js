'use strict';

/*jshint latedef:false */

angular.module('QuepidApp')
  .controller('ChangeTeamOwnerCtrl', [
    '$scope',
    'flash',
    'teamSvc',
    function (
      $scope,
      flash,
      teamSvc
    ) {
      var ctrl = this;
      ctrl.owner = {
        id: null,
      };

      $scope.$watch('ctrl.team', function() {
        ctrl.owner.id = ctrl.team.id;
      });

      // Functions
      ctrl.changeOwner = changeOwner;

      function changeOwner(newOwnerId) {
        console.log('newOwnerId: ', newOwnerId);
        teamSvc.changeOwner(ctrl.team, newOwnerId)
          .then(function() {
            flash.success = 'Owner updated successfully.';
          }, function(response) {
            flash.error = response.data.error;
          });
      }
    }
  ]);
