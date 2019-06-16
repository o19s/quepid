'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueryOptionsCtrl', [
    '$uibModal',
    '$scope',
    '$log',
    'flash',
    function (
      $uibModal,
      $scope,
      $log,
      flash
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
            value: function() { return angular.toJson(ctrl.query.options, true); }
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

            ctrl.query.saveOptions(value)
              .then(function() {
                flash.success = 'Query options saved successfully.';
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
