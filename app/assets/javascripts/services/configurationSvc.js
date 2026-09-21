'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    function ConfigurationSvc() {
      var communalScorersOnly;
      var queryListSortable;
      var caseNo;
      var tryNo;

      this.setCommunalScorersOnly = function(val) {
        communalScorersOnly = JSON.parse(val);
      };

      this.isCommunalScorersOnly = function() {
        return communalScorersOnly;
      };

      this.setQueryListSortable = function (val) {
        queryListSortable = JSON.parse(val);
      };

      this.isQueryListSortable = function() {
        return queryListSortable;
      };

      // caseNo/tryNo for the page Rails just rendered (core/index.html.erb).
      // Seeded once at Angular bootstrap instead of parsed from the URL via
      // ngRoute/$routeParams -- see docs/todo/angularjs_removal_inventory.md.
      this.setCaseNo = function(val) {
        caseNo = parseInt(val, 10);
      };

      this.getCaseNo = function() {
        return caseNo;
      };

      this.setTryNo = function(val) {
        tryNo = parseInt(val, 10);
      };

      this.getTryNo = function() {
        return tryNo;
      };

    }
  ]);
