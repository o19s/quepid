'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    function ConfigurationSvc() {
      var communalScorersOnly;
      var queryListSortable;
      var prefixPath;

      this.getApiPath = function() {
        return prefixPath() + "api/";
      }

      this.setCommunalScorersOnly = function(val) {
        communalScorersOnly = JSON.parse(val);
      };

      this.isCommunalScorersOnly = function() {
        return communalScorersOnly;
      };

      this.setPrefixPath = function(val) {
        prefixPath = val;
      };

      this.prefixPath = function() {
        // Rails doesn't work if path ends with slash, angular requires it
        return prefixPath ? (prefixPath + "/") : "/";
      }

      this.setQueryListSortable = function (val) {
        queryListSortable = JSON.parse(val);
      };

      this.isQueryListSortable = function() {
        return queryListSortable;
      };
    }
  ]);
