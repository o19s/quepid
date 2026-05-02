'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DiffCtrl', [
    '$quepidModal',
    '$log',
    'queryViewSvc', 'queriesSvc',
    function($quepidModal, $log, queryViewSvc, queriesSvc) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;
      ctrl.getCurrentDiffSelection = getCurrentDiffSelection;

      function getCurrentDiffSelection() {
        // Always return the array - getAllDiffSettings handles disabled state
        return queryViewSvc.getAllDiffSettings();
      }

      function prompt() {
        var initialSelection = getCurrentDiffSelection();
        
        var modalInstance = $quepidModal.open({
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
              queryViewSvc.enableDiffs(response.selections);
              queriesSvc.refreshAllDiffs();
            }
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }).then(function() {
            if (!queryViewSvc.isAnyDiffEnabled()){
              $log.info('rescoring queries after cancelling diff');
              queriesSvc.updateScores();
            }
        });
      }
    }
  ]);
