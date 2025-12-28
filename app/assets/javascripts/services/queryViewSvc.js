'use strict';

// Persistent knowledge of the view-state
// of the application across routes
angular.module('QuepidApp')
  .service('queryViewSvc', [
    function() {
      // Initialize properties
      this.diffSettings = [];
      this.comparisonsDisabled = false;
      this.queryToggles = {};

      this.enableDiffs = function(snapshotIds) {
        this.diffSettings = snapshotIds;
        this.comparisonsDisabled = false;
      };

      this.disableComparisons = function() {
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
        this.diffSettings = [];
        this.comparisonsDisabled = false;
        this.queryToggles = {}; // the toggles, they do nothing
      };

      // Unified getter for all diff settings - returns array format
      this.getAllDiffSettings = function() {
        if (this.comparisonsDisabled === true) {
          return [];
        }
        return this.diffSettings;
      };

      // Get maximum number of snapshots allowed for comparison
      this.getMaxSnapshots = function() {
        return 5; // Maximum 5 snapshots for comparison
      };

      // Check if any diff is enabled
      this.isAnyDiffEnabled = function() {
        return this.getAllDiffSettings().length > 0;
      };

      this.reset();
    }
  ]);
