'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('DiffModalInstanceCtrl', [
    '$scope',
    '$uibModalInstance',
    '$log',
    'flash',
    'querySnapshotSvc', 'queryViewSvc', 'queriesSvc', 'initialSelection',
    function(
      $scope,
      $uibModalInstance,
      $log,
      flash,
      querySnapshotSvc, queryViewSvc, queriesSvc, initialSelection
    ) {
      var ctrl = this;

      ctrl.selections      = [null]; // Start with 1 empty selection
      ctrl.disabled        = false;
      ctrl.inProgress      = false;
      ctrl.snapshots       = null; // Initialize to null until loaded

      // Load snapshots first, then initialize selections
      querySnapshotSvc.getSnapshots().then(function() {
          ctrl.snapshots = querySnapshotSvc.snapshots;
          // Initialize selections after snapshots are loaded
          initializeSelections();
        }
      );

      // Functions
      ctrl.cancel                  = cancel;
      ctrl.clearComparisonView     = clearComparisonView;
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
      $scope.$watchCollection('ctrl.selections', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          validateSelections();
        }
      });

      // Initialize selections based on current state
      function initializeSelections() {
        // Check actual service state for disabled status
        ctrl.disabled = queryViewSvc.areComparisonsDisabled();
        
        // Handle initial selection - now always an array or null
        if (initialSelection === null || (angular.isArray(initialSelection) && initialSelection.length === 0)) {
          ctrl.selections = [null]; // Default to one empty selection
        } else if (angular.isArray(initialSelection)) {
          // Preserve existing selections (single or multi)
          ctrl.selections = initialSelection.slice(); // Copy array
        } else {
          // Fallback for any unexpected format
          ctrl.selections = [null];
        }
      }

      var delState = null;

      function addSelection() {
        if (ctrl.selections.length < queryViewSvc.getMaxSnapshots()) {
          ctrl.selections.push(null);
        }
      }

      function removeSelection(index) {
        if (ctrl.selections.length > 1) {
          ctrl.selections.splice(index, 1);
        } else {
          // Just clear the selection but keep the slot
          ctrl.selections[index] = null;
        }
        validateSelections();
      }

      function canAddMore() {
        return ctrl.selections.length < queryViewSvc.getMaxSnapshots();
      }

      function validateSelections() {
        // Remove any duplicate or empty selections from the end
        getValidSelections();
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
        if (ctrl.snapshots && snapshotId !== null && snapshotId !== undefined) {
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
        // Return loading message if snapshots aren't loaded yet
        if (!ctrl.snapshots) {
          return 'Loading...';
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
            ctrl.disabled = true;

            queryViewSvc.disableComparisons();
            queriesSvc.setDiffSetting(null);

            flash.success = 'Snapshot deleted successfully.';
          });
      }

      function nothingSelected() {
        var validSelections = getValidSelections();
        return validSelections.length === 0 || hasDuplicateSelections();
      }

      function clearComparisonView() {
        queryViewSvc.disableComparisons();
        queriesSvc.setDiffSetting(null);
        queriesSvc.setMultiDiffSetting([]);
        $uibModalInstance.close(null);
        flash.success = 'Comparison view has been cleared.';
      }

      function ok() {
        var validSelections = getValidSelections();
        if (validSelections.length === 0 || hasDuplicateSelections()) {
          // No valid selections - disable all comparisons (same as Clear Comparison View)
          queryViewSvc.disableComparisons();
          queriesSvc.setDiffSetting(null);
          $uibModalInstance.close(null);
          flash.success = 'Comparison view has been cleared.';
        } else {
          ctrl.inProgress = true;
          
          // Fetch all selected snapshots
          var fetchPromises = [];
          angular.forEach(validSelections, function(selectionId) {
            fetchPromises.push(querySnapshotSvc.get(selectionId));
          });
          
          Promise.all(fetchPromises)
            .then(function() {
              ctrl.inProgress = false;
              // Always return selections as array - let controller handle single vs multi
              $uibModalInstance.close({
                selections: validSelections
              });
              
              var message = validSelections.length === 1 
                ? 'Snapshot loaded successfully for comparison.'
                : 'Snapshots loaded successfully for comparison.';
              flash.success = message;
            })
            .catch(function(response) {
              ctrl.inProgress = false;
              flash.error = 'Could not fetch one or more snapshots!';
              $log.debug('error fetching snapshots:');
              $log.debug(response);
            });
        }
      }

      function cancel() {
        $uibModalInstance.dismiss('cancel');
      }
    }
  ]);