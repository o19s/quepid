'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('RemoveMemberCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'teamSvc',
    function (
      $scope,
      $uibModal,
      flash,
      teamSvc
    ) {
      var ctrl = this;

      ctrl.thisMember = $scope.thisMember;
      ctrl.thisTeam   = $scope.thisTeam;

      ctrl.openRemoveModal  = openRemoveModal;
      ctrl.removeMember     = removeMember;

      function openRemoveModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'remove_member/_modal.html',
          controller:   'RemoveMemberModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {
            thisMember: function() { return ctrl.thisMember; },
            thisTeam: function() { return ctrl.thisTeam; }
          }
        });

        modalInstance.result.then(function (deleteClicked) {
          if( deleteClicked ){
            ctrl.removeMember();
          }
        });
      }

      function removeMember() {
        teamSvc.removeMember(ctrl.thisTeam, ctrl.thisMember)
          .then(function() {
            flash.success = 'Member removed';
          }, function(response) {
            flash.error = response.data.error;
          });
      }
    }
  ]);
