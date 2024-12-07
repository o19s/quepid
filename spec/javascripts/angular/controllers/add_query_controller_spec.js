'use strict';

describe('Controller: AddQueryCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  var $rootScope;
  var $q;
  var ctrl;

  var mockQueriesSvcBase = {
    createQuery: function(text) {
      var lastCreatedQ = {
        search: function() {
          return {
            then: function(success) {
              success();
            }
          };
        },
        searchAndScore: function() {
          return {
            then: function(success) {
              success();
            }
          }
        },
        queryText: text
      };

      this.lastCreatedQs.push(lastCreatedQ);
      return lastCreatedQ;
    },
    lastCreatedQs: [],
    lastCreatedQ: function() {
      return this.lastCreatedQs[this.lastCreatedQs.length - 1];
    },
    lastPersistedQs: [],
    lastPersistedQ: function() {
      return this.lastPersistedQs[this.lastPersistedQs.length - 1];
    },
    persistPromises: [],
    lastPersistPromise: function() {
      return this.persistPromises[this.persistPromises.length - 1];
    },
    /*global Promise*/
    persistQuery: function(q) {
      var deferred = $q.defer();

      this.persistPromises.push(deferred);
      this.lastPersistedQs.push(q);
      return deferred.promise;
    },
    persistQueries: function(qs) {
      var that = this;
      var deferred = $q.defer();

      that.persistPromises.push(deferred);
      angular.forEach(qs, function(q) {
        that.lastPersistedQs.push(q);
      });

      return deferred.promise;
    },
    searchAll: function() {
      var promises = [];

      angular.forEach(this.queries, function(query) {
        promises.push(query.search());
      });

      return $q.all(promises);
    }
  };

  var mockUser = {
    isTrial:              false,
    completedCaseWizard:  true
  };

  var mockQueriesSvc;

  beforeEach(function() {
    module(function($provide) {
      mockQueriesSvc = angular.copy(mockQueriesSvcBase);
      $provide.value('queriesSvc', mockQueriesSvc);
    });
    inject(function(_$rootScope_, _$q_, $controller) {
      $rootScope  = _$rootScope_;
      $q          = _$q_;
      ctrl        = $controller('AddQueryCtrl', {});
    });

    $rootScope.currentUser = angular.copy(mockUser);
  });

  it('rejects empty or blank text', function() {
    var newText;
    ctrl.text   = newText;

    expect(mockQueriesSvc.lastCreatedQ()).toBe(undefined);
    ctrl.submit();
    expect(mockQueriesSvc.lastCreatedQ()).toBe(undefined);

    newText = '';
    ctrl.text   = newText;

    ctrl.submit();
    expect(mockQueriesSvc.lastCreatedQ()).toBe(undefined);
  });

  it('adds queries', function() {
    var newText = 'foo';
    ctrl.text   = newText;

    expect(mockQueriesSvc.lastCreatedQ()).toBe(undefined);
    ctrl.submit();

    var createdQ  = mockQueriesSvc.lastCreatedQ();
    var promise   = mockQueriesSvc.lastPersistPromise();

    expect(createdQ.queryText).toBe(newText);
    promise.resolve();
    //$rootScope.$apply();

    var persistedQ = mockQueriesSvc.lastPersistedQ();

    expect(persistedQ).toBe(createdQ);
  });

  it('adds multiple queries', function() {
    var queries = ['gross tacos', 'funny pizzas', 'elmer fudd hats'];
    var delim   = ';';
    ctrl.text   = queries.join(delim);
    ctrl.submit();

    var createdQs = mockQueriesSvc.lastCreatedQs;

    expect(createdQs.length).toBe(3);
    expect(createdQs[0].queryText).toBe(queries[0]);
    expect(createdQs[1].queryText).toBe(queries[1]);
    expect(createdQs[2].queryText).toBe(queries[2]);
  });

  it('trims away whitespace on queries', function() {
    var queries = ['gross tacos', 'funny pizzas', ' elmer fudd hats ', ' '];
    var delim   = ';';

    ctrl.text = queries.join(delim);
    ctrl.submit();

    var createdQs = mockQueriesSvc.lastCreatedQs;

    expect(createdQs.length).toBe(3);
    expect(createdQs[0].queryText).toBe('gross tacos');
    expect(createdQs[1].queryText).toBe('funny pizzas');
    expect(createdQs[2].queryText).toBe('elmer fudd hats');
  });
});
