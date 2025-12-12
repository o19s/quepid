'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DiffCtrl', [
    '$uibModal',
    '$log',
    'queryViewSvc', 'queriesSvc', 'multiDiffResultsSvc',
    function($uibModal, $log, queryViewSvc, queriesSvc, multiDiffResultsSvc) {
      var ctrl = this;

      // Functions
      ctrl.prompt = prompt;

      function prompt() {
        var currentMultiDiffSettings = multiDiffResultsSvc.getMultiDiffSettings();
        var currentSingleDiffSetting = queryViewSvc.diffSetting;
        var isDisabled = queryViewSvc.areComparisonsDisabled();
        
        // Unified state detection: check all possible sources for current diff state
        var initialSelection = null;
        if (isDisabled) {
          // Comparisons are explicitly disabled
          initialSelection = null;
        } else if (currentMultiDiffSettings.length > 1) {
          // Multi-diff mode (2+ snapshots)
          initialSelection = currentMultiDiffSettings;
        } else if (currentMultiDiffSettings.length === 1) {
          // Single diff stored in multiDiffResultsSvc (this is how single diffs actually work internally)
          initialSelection = currentMultiDiffSettings[0];
        } else if (currentSingleDiffSetting !== null && currentSingleDiffSetting !== undefined) {
          // Fallback: single diff stored in queryViewSvc (legacy or timing edge case)
          initialSelection = currentSingleDiffSetting;
        }
        
        var modalInstance = $uibModal.open({
          templateUrl:  'diff/_modal.html',
          controller:   'DiffModalInstanceCtrl',
          controllerAs: 'ctrl',
          size: 'lg',
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
              queriesSvc.setDiffSetting(null);
              multiDiffResultsSvc.setMultiDiffSettings([]);
            } else if (response.type === 'multi') {
              // Multi-snapshot mode
              queryViewSvc.enableMultiDiff(response.selections);
              multiDiffResultsSvc.setMultiDiffSettings(response.selections);
              queriesSvc.setMultiDiffSetting(response.selections);
            } else if (response.type === 'single') {
              // Single snapshot mode - fall back to regular diff
              queryViewSvc.enableDiff(response.selection);
              queriesSvc.setDiffSetting(response.selection);
              multiDiffResultsSvc.setMultiDiffSettings([]);
            }
          },
          function() {
            $log.info('INFO: Modal dismissed');
          }).then(function() {
            if (!queryViewSvc.isDiffEnabled() && !multiDiffResultsSvc.isMultiDiffEnabled()){
              $log.info('rescoring queries after cancelling diff');
              queriesSvc.updateScores();
            }
        });
      }
    }
  ]);
