'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('CloneScorerCtrl', [
    '$uibModal',
    '$scope',
    '$rootScope',
    '$log',
    'flash',
    'customScorerSvc',
    function (
      $uibModal,
      $scope,
      $rootScope,
      $log,
      flash,
      customScorerSvc
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
      ctrl.cloneScorer = cloneScorer;

      function cloneScorer() {
        $log.info('INFO: Opened modal to clone Scorer!');
        var modalInstance = $uibModal.open({
          templateUrl:  'clone_scorer/_modal.html',
          controller:   'CloneScorerModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve : {
            scorer: function() {
              return $scope.scorer;
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
