'use strict';

// Persistent knowledge of the view-state
// of the application across routes
angular.module('QuepidApp')
  .service('queryViewSvc', [
    function() {
      // Initialize properties
      this.diffSetting = null;
      this.diffSettings = [];
      this.comparisonsDisabled = false;
      this.queryToggles = {};

      this.enableDiff = function(snapshotId) {
        this.diffSetting = snapshotId;
        this.diffSettings = [snapshotId];
        this.comparisonsDisabled = false;
      };

      this.enableDiffs = function(snapshotIds) {
        this.diffSettings = snapshotIds || [];
        this.diffSetting = snapshotIds && snapshotIds.length === 1 ? snapshotIds[0] : null;
        this.comparisonsDisabled = false;
      };

      this.disableComparisons = function() {
        this.diffSetting = null;
        this.diffSettings = [];
        this.comparisonsDisabled = true;
      };

      this.areComparisonsDisabled = function() {
        return this.comparisonsDisabled === true;
      };




      this.isQueryToggled = function(queryId) {
        if (!this.queryToggles.hasOwnProperty(queryId)) {
          this.queryToggles[queryId] = false;
        }
        return (this.queryToggles[queryId]);
      };

      this.toggleQuery = function(queryId) {
        if (!this.queryToggles.hasOwnProperty(queryId)) {
          this.queryToggles[queryId] = false;
        }
        this.queryToggles[queryId] = !this.queryToggles[queryId];
      };

      this.collapseAll = function() {
        this.queryToggles = {};
      };

      this.reset = function() {
        this.diffSetting = null;
        this.diffSettings = [];
        this.comparisonsDisabled = false;
        this.queryToggles = {}; // the toggles, they do nothing
      };

      // Unified getter for all diff settings - returns array format
      this.getAllDiffSettings = function() {
        if (this.comparisonsDisabled === true) {
          return [];
        }
        if (this.diffSettings && this.diffSettings.length > 0) {
          return this.diffSettings;
        } else if (this.diffSetting !== null) {
          return [this.diffSetting];
        }
        return [];
      };

      // Get maximum number of snapshots allowed for comparison
      this.getMaxSnapshots = function() {
        return 5; // Maximum 5 snapshots for comparison
      };

      // Check if any diff is enabled (single or multi)
      this.isAnyDiffEnabled = function() {
        return this.getAllDiffSettings().length > 0;
      };

      this.reset();
    }
  ]);
