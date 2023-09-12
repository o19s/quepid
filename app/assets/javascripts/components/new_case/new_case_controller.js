'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('NewCaseCtrl', [
    '$rootScope',
    '$scope',
    '$location',
    '$uibModal',
    '$timeout',
    'caseSvc',
    function (
      $rootScope,
      $scope,
      $location,
      $uibModal,
      $timeout,
      caseSvc
    ) {
      var ctrl = this;
      ctrl.buttonText = $scope.buttonText;

      // Functions
      ctrl.newCase = newCase;

      $scope.bootstrapped = caseSvc.isBootstrapped;
      $scope.$watch('bootstrapped()', function() {
        if ( $scope.bootstrapped() ) {
          var searchObject = $location.search();
          if ( angular.isDefined(searchObject.new) && searchObject.new === 'true' ) {
            $location.search('new', null);
            $rootScope.$watch('currentUser', function() {
              ctrl.newCase();
            });
          }
        }
      });

      function newCase() {
        // the server will bootstrap a new case
        // and return some default values down
        caseSvc.createCase(); //Note createCase() switches to the new case

        var modalInstance = $uibModal.open({
          templateUrl:  'views/wizardModal.html',
          controller:   'WizardModalCtrl', 
          backdrop:     'static'
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
