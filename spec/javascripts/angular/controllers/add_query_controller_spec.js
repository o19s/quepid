'use strict';

describe('Controller: AddQueryCtrl', function () {

  // load the controller's module
  beforeEach(module('QuepidTest'));

  let $rootScope;
  let $q;
  let ctrl;

  const mockQueriesSvcBase = {
    createQuery: function(text) {
      const lastCreatedQ = {
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
      const deferred = $q.defer();

      this.persistPromises.push(deferred);
      this.lastPersistedQs.push(q);
      return deferred.promise;
    },
    persistQueries: function(qs) {
      const that = this;
      const deferred = $q.defer();

      that.persistPromises.push(deferred);
      angular.forEach(qs, function(q) {
        that.lastPersistedQs.push(q);
      });

      return deferred.promise;
    },
    searchAll: function() {
      const promises = [];

      angular.forEach(this.queries, function(query) {
        promises.push(query.search());
      });

      return $q.all(promises);
    }
  };

  const mockUser = {
    isTrial:              false,
    completedCaseWizard:  true
  };

  let mockQueriesSvc;

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
    const newText;
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
    const newText = 'foo';
    ctrl.text   = newText;

    expect(mockQueriesSvc.lastCreatedQ()).toBe(undefined);
    ctrl.submit();

    const createdQ  = mockQueriesSvc.lastCreatedQ();
    const promise   = mockQueriesSvc.lastPersistPromise();

    expect(createdQ.queryText).toBe(newText);
    promise.resolve();
    $rootScope.$apply();

    const persistedQ = mockQueriesSvc.lastPersistedQ();

    expect(persistedQ).toBe(createdQ);
  });

  it('adds multiple queries', function() {
    const queries = ['gross tacos', 'funny pizzas', 'elmer fudd hats'];
    const delim   = ';';
    ctrl.text   = queries.join(delim);
    ctrl.submit();

    const createdQs = mockQueriesSvc.lastCreatedQs;

    expect(createdQs.length).toBe(3);
    expect(createdQs[0].queryText).toBe(queries[0]);
    expect(createdQs[1].queryText).toBe(queries[1]);
    expect(createdQs[2].queryText).toBe(queries[2]);
  });

  it('trims away whitespace on queries', function() {
    const queries = ['gross tacos', 'funny pizzas', ' elmer fudd hats ', ' '];
    const delim   = ';';

    ctrl.text = queries.join(delim);
    ctrl.submit();

    const createdQs = mockQueriesSvc.lastCreatedQs;

    expect(createdQs.length).toBe(3);
    expect(createdQs[0].queryText).toBe('gross tacos');
    expect(createdQs[1].queryText).toBe('funny pizzas');
    expect(createdQs[2].queryText).toBe('elmer fudd hats');
  });
});
