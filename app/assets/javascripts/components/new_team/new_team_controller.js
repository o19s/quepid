'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('NewTeamCtrl', [
    '$log',
    '$uibModal',
    '$scope',
    '$rootScope',
    'flash',
    'teamSvc',
    function (
      $log,
      $uibModal,
      $scope,
      $rootScope,
      flash,
      teamSvc
    ) {
      var ctrl = this;
      ctrl.buttonText = $scope.buttonText;

      // Functions
      ctrl.newTeam = newTeam;

      function newTeam() {
        $log.info('INFO: Opened modal to create new Team!');
        var modalInstance = $uibModal.open({
          templateUrl:  'new_team/_modal.html',
          controller:   'NewTeamModalInstanceCtrl',
          controllerAs: 'ctrl',
        });

        modalInstance.result.then(
          function(teamName) {
            teamSvc.create(teamName)
              .then(function() {
                flash.success = 'Team created successfully';
              }, function(response) {
                var errorMessage = 'Oops! Could not save your team for the following reasons:';

                var fullMessage = [];
                angular.forEach(response.data, function(message, attribute) {
                  fullMessage.push(attribute + ': ' + message + '.');
                });

                errorMessage += ' ' + fullMessage.join(' | ');

                flash.error = errorMessage;
              });
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
