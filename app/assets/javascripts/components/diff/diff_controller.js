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
        var initialSelection = currentMultiDiffSettings.length > 0 ? currentMultiDiffSettings : null;
        
        var modalInstance = $uibModal.open({
          templateUrl:  'diff/_multi_modal.html',
          controller:   'MultiDiffModalInstanceCtrl',
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
              queryViewSvc.reset();
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
