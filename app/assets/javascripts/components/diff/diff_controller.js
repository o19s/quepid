'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DiffCtrl', [
    '$uibModal',
    'queryViewSvc', 'queriesSvc',
    function($uibModal, queryViewSvc, queriesSvc) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var modalInstance = $uibModal.open({
          templateUrl:  'diff/_modal.html',
          controller:   'DiffModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            initialSelection: function() {
              return queryViewSvc.diffSetting;
            }
          }
        });

        modalInstance.result
          .then(function(response) {
            queryViewSvc.enableDiff(response);
            queriesSvc.setDiffSetting(response);
          },
          function() {
            console.log('Diff modal failed to close properly.');
          });
      }
    }
  ]);
