'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('CloneScorerCtrl', [
    '$uibModal',
    '$scope',
    '$rootScope',
    '$log',
    'flash',
    'scorerSvc',
    function (
      $uibModal,
      $scope,
      $rootScope,
      $log,
      flash,
      scorerSvc
    ) {
      var ctrl = this;
      ctrl.buttonText = $scope.buttonText;

      // Functions
      ctrl.cloneScorer = cloneScorer;

      function cloneScorer() {
        $log.info('INFO: Opened modal to clone Scorer!');
        var modalInstance = $uibModal.open({
          templateUrl:  'clone_scorer/_modal.html',
          controller:   'CloneScorerModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'lg',
          resolve : {
            scorer: function() {
              return $scope.scorer;
            }
          }
        });

        modalInstance.result.then(
          function(data) {
            scorerSvc.create(data)
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
