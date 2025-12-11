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
        
      ctrl.selections      = [null]; // Start with 1 empty selection
      ctrl.disabled        = false;
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
      $scope.$watchCollection('ctrl.selections', function(newVal, oldVal) {
        if (newVal !== oldVal) {
          validateSelections();
        }
      });

      // Init - handle initial selection from existing diff
      if (initialSelection === null) {
        ctrl.disabled = false;
      } else if (angular.isArray(initialSelection)) {
        // Multi-diff mode
        ctrl.selections = initialSelection.slice(); // Copy array
        if (ctrl.selections.length === 0) {
          ctrl.selections = [null];
        }
      } else {
        // Single diff mode
        ctrl.selections = [initialSelection];
      }

      var delState = null;

      function addSelection() {
        if (ctrl.selections.length < multiDiffResultsSvc.getMaxSnapshots()) {
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
        return ctrl.selections.length < multiDiffResultsSvc.getMaxSnapshots();
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
            ctrl.disabled = true;

            queryViewSvc.reset();
            queriesSvc.setDiffSetting(null);
            multiDiffResultsSvc.setMultiDiffSettings([]);

            flash.success = 'Snapshot deleted successfully.';
          });
      }

      function nothingSelected() {
        if (ctrl.disabled) {
          return false; // Allow disabling comparisons
        }
        var validSelections = getValidSelections();
        return validSelections.length === 0 || hasDuplicateSelections();
      }

      function ok() {
        if (ctrl.disabled) {
          // Disable all diffs
          queryViewSvc.reset();
          queriesSvc.setDiffSetting(null);
          multiDiffResultsSvc.setMultiDiffSettings([]);
          $uibModalInstance.close(null);
        } else {
          var validSelections = getValidSelections();
          if (validSelections.length > 0 && !hasDuplicateSelections()) {
            ctrl.inProgress = true;
            
            // Fetch all selected snapshots
            var fetchPromises = [];
            angular.forEach(validSelections, function(selectionId) {
              fetchPromises.push(querySnapshotSvc.get(selectionId));
            });
            
            Promise.all(fetchPromises)
              .then(function() {
                ctrl.inProgress = false;
                if (validSelections.length === 1) {
                  // Single snapshot - use legacy single diff
                  $uibModalInstance.close({
                    type: 'single',
                    selection: validSelections[0]
                  });
                  flash.success = 'Snapshot loaded successfully for comparison.';
                } else {
                  // Multiple snapshots - use multi-diff
                  $uibModalInstance.close({
                    type: 'multi',
                    selections: validSelections
                  });
                  flash.success = 'Snapshots loaded successfully for comparison.';
                }
              })
              .catch(function(response) {
                ctrl.inProgress = false;
                flash.error = 'Could not fetch one or more snapshots!';
                $log.debug('error fetching snapshots:');
                $log.debug(response);
              });
          }
        }
      }

      function cancel() {
        $uibModalInstance.dismiss('cancel');
      }
    }
  ]);