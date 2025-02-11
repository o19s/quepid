'use strict';

angular.module('UtilitiesModule')
  .service('configurationSvc', [
    function ConfigurationSvc() {
      var communalScorersOnly;
      var queryListSortable;
      var preferSSL;

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
      
      this.setPreferSSL= function (val) {
        preferSSL = JSON.parse(val);
      };

      this.preferSSL = function() {
        return preferSSL;
      };      
    }
  ]);
