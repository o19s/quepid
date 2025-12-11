'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('MultiDiffModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    '$log',
    'flash',
    'querySnapshotSvc', 'queryViewSvc', 'queriesSvc', 'multiDiffResultsSvc', 'initialSelection',
    function(
      $scope,
      $uibModalInstance,
      $log,
      flash,
      querySnapshotSvc, queryViewSvc, queriesSvc, multiDiffResultsSvc, initialSelection
    ) {
      var ctrl = this;

      querySnapshotSvc.getSnapshots().then(function() {
          ctrl.snapshots = querySnapshotSvc.snapshots;
        }
      );
        
      ctrl.which           = 'multi-snapshot';
      ctrl.selections      = [null, null]; // Start with 2 empty selections
      ctrl.singleSelection = null;
      ctrl.inProgress      = false;

      // Functions
      ctrl.cancel                  = cancel;
      ctrl.delConfirm              = delConfirm;
      ctrl.delStarted              = delStarted;
      ctrl.nothingSelected         = nothingSelected;
      ctrl.ok                      = ok;
      ctrl.toggleDel               = toggleDel;
      ctrl.addSelection            = addSelection;
      ctrl.removeSelection         = removeSelection;
      ctrl.canAddMore              = canAddMore;
      ctrl.validateSelections      = validateSelections;
      ctrl.getValidSelections      = getValidSelections;
      ctrl.hasDuplicateSelections  = hasDuplicateSelections;
      ctrl.hasProcessingSnapshots  = hasProcessingSnapshots;
      ctrl.getSnapshotName         = getSnapshotName;

      // Watches
      $scope.$watch('ctrl.singleSelection', function(newVal, oldVal) {
        if (newVal !== oldVal && newVal) {
          ctrl.which = 'snapshot';
        }
      });

      $scope.$watchCollection('ctrl.selections', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          var hasValidSelection = false;
          angular.forEach(newVal, function(selection) {
            if (selection !== null && selection !== undefined && selection !== '') {
              hasValidSelection = true;
            }
          });
          if (hasValidSelection) {
            ctrl.which = 'multi-snapshot';
          }
        }
      });

      // Init - handle initial selection from existing diff
      if (initialSelection === null) {
        ctrl.which = 'none';
      } else if (angular.isArray(initialSelection)) {
        // Multi-diff mode
        ctrl.which = 'multi-snapshot';
        ctrl.selections = initialSelection.slice(); // Copy array
        // Ensure we have at least 2 slots
        while (ctrl.selections.length < 2) {
          ctrl.selections.push(null);
        }
      } else {
        // Single diff mode
        ctrl.which = 'snapshot';
        ctrl.singleSelection = initialSelection;
      }

      var delState = null;

      function addSelection() {
        if (ctrl.selections.length < multiDiffResultsSvc.getMaxSnapshots()) {
          ctrl.selections.push(null);
        }
      }

      function removeSelection(index) {
        if (ctrl.selections.length > 2) {
          ctrl.selections.splice(index, 1);
        } else {
          // Just clear the selection but keep the slot
          ctrl.selections[index] = null;
        }
        validateSelections();
      }

      function canAddMore() {
        return ctrl.selections.length < multiDiffResultsSvc.getMaxSnapshots();
      }

      function validateSelections() {
        // Remove any duplicate or empty selections from the end
        var validSelections = getValidSelections();
        // This function is called to trigger UI updates
      }

      function getValidSelections() {
        var validSelections = [];
        var seen = {};
        
        angular.forEach(ctrl.selections, function(selection) {
          if (selection !== null && selection !== undefined && selection !== '' && !seen[selection]) {
            validSelections.push(selection);
            seen[selection] = true;
          }
        });
        
        return validSelections;
      }

      function hasDuplicateSelections() {
        var seen = {};
        var hasDupe = false;
        
        angular.forEach(ctrl.selections, function(selection) {
          if (selection !== null && selection !== undefined && selection !== '') {
            if (seen[selection]) {
              hasDupe = true;
            }
            seen[selection] = true;
          }
        });
        
        return hasDupe;
      }

      function hasProcessingSnapshots() {
        if (!ctrl.snapshots) {
          return false;
        }

        var selectionsToCheck = [];
        if (ctrl.which === 'multi-snapshot') {
          selectionsToCheck = getValidSelections();
        } else if (ctrl.which === 'snapshot' && ctrl.singleSelection) {
          selectionsToCheck = [ctrl.singleSelection];
        }

        var hasProcessing = false;
        angular.forEach(selectionsToCheck, function(selectionId) {
          angular.forEach(ctrl.snapshots, function(snapshot) {
            if (snapshot.id === selectionId && snapshot.hasSnapshotFile) {
              hasProcessing = true;
            }
          });
        });

        return hasProcessing;
      }

      function getSnapshotName(snapshotId) {
        if (ctrl.snapshots) {
          var foundSnapshot = null;
          angular.forEach(ctrl.snapshots, function(snapshot) {
            if (snapshot.id === snapshotId) {
              foundSnapshot = snapshot;
            }
          });
          if (foundSnapshot) {
            return foundSnapshot.name();
          }
        }
        return 'Unknown Snapshot';
      }

      function toggleDel(snapId) {
        if (delState === null) {
          delState = snapId;
        } else {
          delState = null;
        }
      }

      function delStarted() {
        return (delState !== null);
      }

      function delConfirm() {
        querySnapshotSvc.deleteSnapshot(delState)
          .then(function() {
            delState = null;
            ctrl.which = 'none';

            queryViewSvc.reset();
            queriesSvc.setDiffSetting(null);
            multiDiffResultsSvc.setMultiDiffSettings([]);

            flash.success = 'Snapshot deleted successfully.';
          });
      }

      function nothingSelected() {
        if (ctrl.which === 'multi-snapshot') {
          var validSelections = getValidSelections();
          return validSelections.length < 2 || hasDuplicateSelections();
        } else if (ctrl.which === 'snapshot') {
          return angular.isUndefined(ctrl.singleSelection) || ctrl.singleSelection === null || ctrl.singleSelection === '';
        }

        return false;
      }

      function ok() {
        if (ctrl.which === 'none') {
          // Disable all diffs
          queryViewSvc.reset();
          queriesSvc.setDiffSetting(null);
          multiDiffResultsSvc.setMultiDiffSettings([]);
          $uibModalInstance.close(null);
        } else if (ctrl.which === 'multi-snapshot') {
          var validSelections = getValidSelections();
          if (validSelections.length >= 2 && !hasDuplicateSelections()) {
            ctrl.inProgress = true;
            
            // Fetch all selected snapshots
            var fetchPromises = [];
            angular.forEach(validSelections, function(selectionId) {
              fetchPromises.push(querySnapshotSvc.get(selectionId));
            });
            
            Promise.all(fetchPromises)
              .then(function() {
                ctrl.inProgress = false;
                $uibModalInstance.close({
                  type: 'multi',
                  selections: validSelections
                });
                flash.success = 'Multiple snapshots loaded successfully for comparison.';
              })
              .catch(function(response) {
                ctrl.inProgress = false;
                flash.error = 'Could not fetch one or more snapshots!';
                $log.debug('error fetching snapshots:');
                $log.debug(response);
              });
          }
        } else if (ctrl.which === 'snapshot') {
          // Single snapshot mode - use existing logic
          ctrl.inProgress = true;
          querySnapshotSvc.get(ctrl.singleSelection)
            .then(function() {
              ctrl.inProgress = false;
              $uibModalInstance.close({
                type: 'single',
                selection: ctrl.singleSelection
              });
              flash.success = 'Snapshot loaded successfully.';
            }, function (response) {
              ctrl.inProgress = false;
              flash.error = 'Could not fetch snapshot!';
              $log.debug('error fetching snapshot:');
              $log.debug(response);
            });
        }
      }

      function cancel() {
        $uibModalInstance.dismiss('cancel');
      }
    }
  ]);