'use strict';

// Persistent knowledge of the view-state
// of the application across routes
angular.module('QuepidApp')
  .service('queryViewSvc', [
    function() {
      this.enableDiff = function(snapshotId) {
        this.diffSetting = snapshotId;
        this.multiDiffSettings = [];
        this.comparisonsDisabled = false;
      };

      this.enableMultiDiff = function(snapshotIds) {
        this.multiDiffSettings = snapshotIds || [];
        this.diffSetting = null;
        this.comparisonsDisabled = false;
      };

      this.disableComparisons = function() {
        this.diffSetting = null;
        this.multiDiffSettings = [];
        this.comparisonsDisabled = true;
      };

      this.areComparisonsDisabled = function() {
        return this.comparisonsDisabled === true;
      };

      this.isDiffEnabled = function() {
        return (this.diffSetting !== null);
      };

      this.isMultiDiffEnabled = function() {
        return (this.multiDiffSettings && this.multiDiffSettings.length > 1);
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
        this.multiDiffSettings = [];
        this.comparisonsDisabled = false;
        this.queryToggles = {}; // the toggles, they do nothing
      };

      this.reset();
    }
  ]);
