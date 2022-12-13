'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('ShareCaseCtrl', [
    '$scope',
    '$uibModal',
    '$log',
    '$routeParams',
    'flash',
    'caseSvc',
    'teamSvc',
    function (
      $scope,
      $uibModal,
      $log,
      $routeParams,
      flash,
      caseSvc,
      teamSvc
    ) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'share_case/_modal.html',
          controller:   'ShareCaseModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            acase: function() {
              return ctrl.acase;
            }
          }
        });

        modalInstance.result.then(
          function(share) {
            var caseNo  = share.acase.caseNo;
            var team    = null;
            if (share.action === 'select') {
              team    = share.selectedTeam;

              teamSvc.shareCase(team, caseNo)
                .then(function() {
                  flash.success = 'Case shared with team successfully.';
                }, function() {
                  flash.error = 'Unable to share case with team.';
                });
            }
            else {
              team    = share.unselectedTeam;

              teamSvc.unshareCase(team, caseNo)
                .then(function() {
                  flash.success = 'Case unshared from team successfully.';
                }, function() {
                  flash.error = 'Unable to unshare case from team.';
                });
            }
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
