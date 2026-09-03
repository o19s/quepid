'use strict';

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('mapperBasedSearchEngineSvc', [
    '$http',
    function mapperBasedSearchEngineSvc($http) {
      this.engines = [];

      this.list = function() {
        var self = this;

        return $http.get('api/mapper_based_search_engines')
          .then(function(response) {
            self.engines = response.data.mapper_based_search_engines;
          });
      };
    }
  ]);
