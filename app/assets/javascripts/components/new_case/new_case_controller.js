'use strict';

/*jslint latedef:false*/

/**
 * Header "Create a case" control: creates a case via the API, navigates to it, and opens the
 * endpoint wizard. Forced wizard open on load uses `?showWizard=true` (see `wizardCtrl`), not this component.
 */

angular.module('QuepidApp')
  .controller('NewCaseCtrl', [
    '$rootScope',
    '$scope',
    '$quepidModal',
    '$timeout',
    'caseSvc',
    function (
      $rootScope,
      $scope,
      $quepidModal,
      $timeout,
      caseSvc
    ) {
      var ctrl = this;
      ctrl.buttonText = $scope.buttonText;

      // Functions
      ctrl.newCase = newCase;

      function newCase() {
        // the server will bootstrap a new case
        // and return some default values down
        caseSvc.createCase(); //Note createCase() switches to the new case

        var modalInstance = $quepidModal.open({
          templateUrl:  'views/wizardModal.html',
          controller:   'WizardModalCtrl',
          backdrop:     'static',
          windowClass:  'wizard-modal-window'
        });

        if (!$rootScope.currentUser.completedCaseWizard) {
          modalInstance.result.then(function() {
            /* global setupAndStartTour */
            $timeout(setupAndStartTour, 1500);
          });
        }
      }
    }
  ]);
