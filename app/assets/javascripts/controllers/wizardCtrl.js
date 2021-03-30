'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('WizardCtrl', [
    '$rootScope', '$scope', '$uibModal', '$timeout',
    'userSvc',
    function ($rootScope, $scope, $uibModal, $timeout, userSvc) {
      $scope.wizard = {};
      $scope.wizard.triggerModal = function() {

        var modalInstance = $uibModal.open({
          templateUrl: 'views/wizardModal.html',
          controller: 'WizardModalCtrl', //be ready to rename to tutorial modal 1
          backdrop: 'static'
        });

        modalInstance.result.then(function() {
          /* global setupAndStartTour */
          $timeout(setupAndStartTour, 1500);
        });
      };

      $rootScope.$watch( 'currentUser', function(user) {
        if ( angular.isDefined(user) && user !== null ) {
          if ( showModal() ) {
            $scope.wizard.triggerModal();
          }
        }
      });

      // All the logic to detect if a user is not part of a team and
      // has just logged on so we should start them on the case.
      // could be replace with a big button "Create your First Case"!
      function showModal() {
        //return angular.isDefined($rootScope.currentUser) &&
        //  $rootScope.currentUser !== null &&
        //  ($rootScope.currentUser.firstLogin || userSvc.triggerWizard) &&
        //  $rootScope.currentUser.introWizardSeen !== true;
        // move some logic about triggerWizard into backend home_controller.rb
        return angular.isDefined($rootScope.currentUser) &&
          $rootScope.currentUser !== null &&
          ($rootScope.currentUser.firstLogin && !$rootScope.currentUser.belongsToTeam) &&
          $rootScope.currentUser.introWizardSeen !== true;
      }
    }
  ]);
