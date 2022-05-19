'use strict';

// Persistent knowledge of the view-state
// of the application across routes
angular.module('QuepidApp')
  .service('queryViewSvc', [
    function() {
      this.enableDiff = function(idOrBest) {
        this.diffSetting = idOrBest;
      };

      this.isDiffEnabled = function() {
        return (this.diffSetting !== null);
      };

      this.isQueryToggled = function(queryId) {
        if (!this.queryToggles.hasOwnProperty(queryId)) {
          this.queryToggles[queryId] = false;
        }
        return (this.queryToggles[queryId]);
      };

      this.markQueryNeedsRefresh = function(queryId) {
        if (!this.queryNeedsRefresh.hasOwnProperty(queryId)) {
          this.queryNeedsRefresh[queryId] = false;
        }
        this.queryNeedsRefresh[queryId] = true;
      };

      this.isQueryRefreshed = function(queryId) {
        if (!this.queryNeedsRefresh.hasOwnProperty(queryId)) {
          this.queryNeedsRefresh[queryId] = false;
        }
        return (this.queryNeedsRefresh[queryId]);
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
        this.queryToggles = {}; // the toggles, they do nothing
        this.queryNeedsRefresh = {}; // the refreshes, they do nothing!
      };

      this.reset();
    }
  ]);
