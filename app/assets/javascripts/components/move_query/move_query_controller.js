'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('MoveQueryCtrl', [
    '$scope',
    '$uibModal',
    '$log',
    'flash',
    'queriesSvc',
    function (
      $scope,
      $uibModal,
      $log,
      flash,
      queriesSvc
    ) {
      var ctrl = this;
      ctrl.query = $scope.query;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'move_query/_modal.html',
          controller:   'MoveQueryModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            query: function() { return ctrl.query; }
          }
        });

        modalInstance.result.then(function (selectedItem) {
          $log.info('selected case:' + selectedItem);
          $log.info(selectedItem);

          queriesSvc.moveQuery(ctrl.query, selectedItem)
            .then(function() {
              flash.success = 'Query moved successfully!';
              $log.info('rescoring queries after moving query');
              queriesSvc.updateScores();
            }, function() {
              flash.error = 'Unable to move query.';
            });
        }, function() {
          $log.info('dismissed query move modal at: ' + new Date());
        });
      }
    }
  ]);
