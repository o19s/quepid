'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('NewScorerCtrl', [
    '$uibModal',
    '$scope',
    '$rootScope',
    '$log',
    'flash',
    'customScorerSvc',
    'ScorerFactory',
    function (
      $uibModal,
      $scope,
      $rootScope,
      $log,
      flash,
      customScorerSvc,
      ScorerFactory
    ) {
      var ctrl = this;
      ctrl.buttonText = $scope.buttonText;

      ctrl.cannotCreate = true;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.cannotCreate = !$rootScope.currentUser.permissions.team.create;
        }
      });

      // Functions
      ctrl.newScorer = newScorer;

      function newScorer() {
        $log.info('INFO: Opened modal to create new Scorer!');
        var modalInstance = $uibModal.open({
          templateUrl:  'new_scorer/_modal.html',
          controller:   'NewScorerModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve : {
            defaultScorer: function() {
              return new ScorerFactory();
            }
          }
        });

        modalInstance.result.then(
          function(data) {
            customScorerSvc.create(data)
              .then(function() {
                flash.success = 'Scorer created successfully';
              },
              function(data) {
                flash.error = data.message;
              });
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
