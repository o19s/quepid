'use strict';

 /*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('TeamListingCtrl', [
    '$scope',
    '$location',
    '$window',
    'flash',
    'teamSvc',
    function (
      $scope,
      $location,
      $window,
      flash,
      teamSvc
    ) {
      var ctrl = this;

      ctrl.team        = $scope.team;
      ctrl.clickToEdit = {};
      ctrl.clickToEdit.oldVal   = ctrl.team.name.slice(0);
      ctrl.clickToEdit.currVal  = ctrl.team.name.slice(0);
      ctrl.clickToEdit.clicked  = false;

      // we may get bound to different cases on moves, reset the state
      $scope.$watch('ctrl.team', function() {
        ctrl.clickToEdit.currVal = ctrl.team.name.slice(0);
        ctrl.clickToEdit.clicked = false;
      });

      // Functions
      ctrl.deleteTeam = deleteTeam;
      ctrl.goToTeam   = goToTeam;
      ctrl.rename     = rename;

      ctrl.clickToEdit.cancel = cancel;
      ctrl.clickToEdit.submit = submit;

      function rename() {
        ctrl.clickToEdit.clicked = true;
      }

      function goToTeam() {
        var path = '/teams/' + ctrl.team.id;
        $location.path(path);
      }

      function deleteTeam() {
        var deleteTeam = $window.confirm('Are you absolutely sure you want to delete?');

        if (deleteTeam) {
          teamSvc.delete(ctrl.team)
            .then(function() {
              flash.success = 'Team delete successfully';
            }, function(response) {
              flash.error = response.data.message;
            });
        }
      }

      function cancel() {
        ctrl.team.name            = ctrl.clickToEdit.oldVal;
        ctrl.clickToEdit.currVal  = ctrl.clickToEdit.oldVal;
        ctrl.clickToEdit.clicked  = false;
      }

      function submit() {
        ctrl.clickToEdit.clicked = false;

        if (ctrl.clickToEdit.oldVal !== ctrl.clickToEdit.currVal) {
          ctrl.clickToEdit.oldVal = ctrl.clickToEdit.currVal;
          ctrl.team.name          = ctrl.clickToEdit.currVal;

          teamSvc.edit(ctrl.team)
            .then(function() {
              flash.success = 'Team updated successfully';
            }, function(response) {
              flash.error = response.data.message;
            });
        }
      }
    }
  ]);
