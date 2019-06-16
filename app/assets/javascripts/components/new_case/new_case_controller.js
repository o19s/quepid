'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('NewCaseCtrl', [
    '$rootScope',
    '$scope',
    '$location',
    '$uibModal',
    'caseSvc',
    function (
      $rootScope,
      $scope,
      $location,
      $uibModal,
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
          controller:   'WizardModalCtrl', //be ready to rename to tutorial modal 1
          backdrop:     'static'
        });

        modalInstance.result.then(function() {
          // Insert text into dev settings + pull out dev setting bar
          // Trigger 2nd tutorial here?
        });
      }
    }
  ]);
