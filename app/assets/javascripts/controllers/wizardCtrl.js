'use strict';

/*jslint latedef:false*/

// This control decides when to "trigger" the create case wizard to start up
// based on if a user has just logged on and isn't part of team, so get them to start
// creating a case.  However, if they are part of a team, then we don't trigger it since
// presumably they will be starting with an existing shared case.
// We track this via just seeing how many cases they are involved with.
angular.module('QuepidApp')
  .controller('WizardCtrl', [
    '$rootScope', '$scope', '$uibModal', '$timeout',
    function ($rootScope, $scope, $uibModal, $timeout) {
      $scope.wizard = {};
      $scope.wizard.triggerModal = function() {

        var modalInstance = $uibModal.open({
          templateUrl: 'views/wizardModal.html',
          controller: 'WizardModalCtrl',
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

      // Logic to figure out if we have a valid user who doesn't have
      // access to any existing cases.
      // could be replace with a big button "Create your First Case"!
      function showModal() {
        return angular.isDefined($rootScope.currentUser) &&
          $rootScope.currentUser !== null &&
          (!$rootScope.currentUser.completedCaseWizard && $rootScope.currentUser.casesInvolvedWithCount == 0) &&
          $rootScope.currentUser.introWizardSeen !== true;
      }
    }
  ]);
