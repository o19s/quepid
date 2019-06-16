'use strict';

(function (wind) {
  var MockDoc = function(id) {
    this.id = id;
  };

  wind.MockResolver = function(ids, settings, $q) {
    this.docs = [];
    this.fetchDocs = function() {

      var that      = this;
      var deferred  = $q.defer();

      that.docs.length = 0;
      angular.forEach(ids, function(id) {
        that.docs.push(new MockDoc(id));
      });

      deferred.resolve();

      return deferred.promise;
    };
  };

  wind.MockDocResolverSvc = function($q) {
    this.createResolver = function(ids, settings) {
      this.mockResolver = new MockResolver(ids, settings, $q);
      return this.mockResolver;
    };
  };
})(window);
