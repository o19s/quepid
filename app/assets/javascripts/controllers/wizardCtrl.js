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
            $rootScope.currentUser.shownIntroWizard();
          }
        }
      });

      function showModal() {
        return angular.isDefined($rootScope.currentUser) &&
          $rootScope.currentUser !== null &&
          ($rootScope.currentUser.firstLogin || userSvc.triggerWizard) &&
          $rootScope.currentUser.introWizardSeen !== true;
      }
    }
  ]);
