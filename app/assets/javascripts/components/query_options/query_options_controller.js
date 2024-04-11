'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryOptionsCtrl', [
    '$uibModal',
    '$scope',
    '$log',
    'flash',
    'queriesSvc',
    function (
      $uibModal,
      $scope,
      $log,
      flash,
      queriesSvc
    ) {
      var ctrl  = this;
      ctrl.query = $scope.query;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'query_options/_modal.html',
          controller:   'QueryOptionsModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            value: function() { return ctrl.query.options; }
          }
        });

        modalInstance.result.then(
          function(value) {
            try {
              JSON.parse(value);
            } catch (e) {
              flash.error = 'Please provide a valid JSON object.';
              return;
            }

            ctrl.query.saveOptions(JSON.parse(value))
              .then(function() {
                flash.success = 'Query options saved successfully.';
                $log.info('rescoring queries after changing query options');
                queriesSvc.updateScores();
              }, function() {
                flash.error = 'Unable to save query options.';
              });
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }
        );
      }
    }
  ]);
