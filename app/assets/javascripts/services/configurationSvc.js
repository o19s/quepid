'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    function ConfigurationSvc() {
      var communalScorersOnly;
      var queryListSortable;
      let bs5Enabled;

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

      this.setBs5Enabled = function (val) {
        bs5Enabled = JSON.parse(val);
      };

      this.isBs5Enabled = function() {
        return bs5Enabled;
      };

    }
  ]);
