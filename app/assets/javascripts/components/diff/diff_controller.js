'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DiffCtrl', [
    '$uibModal',
    '$log',
    'queryViewSvc', 'queriesSvc',
    function($uibModal, $log, queryViewSvc, queriesSvc) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;
      ctrl.getCurrentDiffSelection = getCurrentDiffSelection;

      function getCurrentDiffSelection() {
        if (queryViewSvc.areComparisonsDisabled()) {
          return null;
        }
        
        // Always return the array - let the modal handle the logic
        return queryViewSvc.getAllDiffSettings();
      }

      function prompt() {
        var initialSelection = getCurrentDiffSelection();
        
        var modalInstance = $uibModal.open({
          templateUrl:  'diff/_modal.html',
          controller:   'DiffModalInstanceCtrl',
          controllerAs: 'ctrl',
          resolve: {
            initialSelection: function() {
              return initialSelection;
            }
          }
        });

        modalInstance.result
          .then(function(response) {
            if (response === null) {
              // Disable all diffs
              queryViewSvc.disableComparisons();
              queriesSvc.refreshAllDiffs();
            } else if (response.selections && response.selections.length > 0) {
              // Always use enableDiffs since it handles both single and multi cases
              queryViewSvc.enableDiffs(response.selections);
              queriesSvc.refreshAllDiffs();
            }
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }).then(function() {
            if (!queryViewSvc.isDiffEnabled() && !queryViewSvc.isAnyDiffEnabled()){
              $log.info('rescoring queries after cancelling diff');
              queriesSvc.updateScores();
            }
        });
      }
    }
  ]);
