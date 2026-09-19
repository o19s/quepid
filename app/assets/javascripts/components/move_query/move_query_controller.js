'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('MoveQueryCtrl', [
    '$scope',
    '$quepidModal',
    '$log',
    'queriesSvc',
    function (
      $scope,
      $quepidModal,
      $log,
      queriesSvc
    ) {
      var ctrl = this;
      ctrl.query = $scope.query;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $quepidModal.open({
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
              window.quepidDom.flash.show('success', 'Query moved successfully!');
              $log.info('rescoring queries after moving query');
              queriesSvc.updateScores();
            }, function() {
              window.quepidDom.flash.show('error', 'Unable to move query.');
            });
        }, function() {
          $log.info('dismissed query move modal at: ' + new Date());
        });
      }
    }
  ]);
