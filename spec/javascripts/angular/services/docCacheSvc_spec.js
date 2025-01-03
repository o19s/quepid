'use strict';

describe('Service: docCacheSvc', function () {

  // load the service's module
  beforeEach(module('QuepidApp'));

  // instantiate service
  var $rootScope;
  var $q;
  var docCacheSvc;
  var docResolverSvc;
  var ignoredSettings = {
    proxyRequests: false,
    searchEngine: 'solr'
  };

  beforeEach(function() {
    inject(function(_$rootScope_, _$q_, _docCacheSvc_, _docResolverSvc_) {
      $rootScope      = _$rootScope_;
      $q              = _$q_;
      docCacheSvc     = _docCacheSvc_;
      docResolverSvc  = _docResolverSvc_;

      spyOn(docResolverSvc, "createResolver").and
        .callFake(function(ids, settings) {
          /*global MockResolver*/
          this.mockResolver = new MockResolver(ids, settings, $q);
          return this.mockResolver;
        });
    });
  });

  var checkSetupFromScratch = function() {
    var called = 0;
    docCacheSvc.addIds(['1', '2', '3']);
    expect(docCacheSvc.hasDoc('1')).toBeFalsy();
    expect(docCacheSvc.hasDoc('2')).toBeFalsy();
    expect(docCacheSvc.hasDoc('3')).toBeFalsy();

    docCacheSvc.update(ignoredSettings)
      .then(function() {
        expect(docCacheSvc.getDoc('1').id).toBe('1');
        expect(docCacheSvc.getDoc('2').id).toBe('2');
        expect(docCacheSvc.getDoc('3').id).toBe('3');
        called++;
      });

    $rootScope.$apply();
    expect(called).toBe(1);
  };

  describe('resolving wholly/partially/not-at-all', function() {
    it('does basics', function() {
      checkSetupFromScratch();
    });

    it('resolves only on new ids', function () {
      checkSetupFromScratch();

      docCacheSvc.addIds(['1', '2', '3', '4']);
      expect(docCacheSvc.hasDoc('1')).toBeTruthy();
      expect(docCacheSvc.hasDoc('2')).toBeTruthy();
      expect(docCacheSvc.hasDoc('3')).toBeTruthy();
      expect(docCacheSvc.hasDoc('4')).toBeFalsy();
      expect(docCacheSvc.knowsDoc('4')).toBeTruthy();

      var called = 0;
      docCacheSvc.update(ignoredSettings)
        .then(function() {
          expect(docCacheSvc.hasDoc('1')).toBeTruthy();
          expect(docCacheSvc.hasDoc('2')).toBeTruthy();
          expect(docCacheSvc.hasDoc('3')).toBeTruthy();
          expect(docCacheSvc.hasDoc('4')).toBeTruthy();
          expect(docCacheSvc.getDoc('1').id).toBe('1');
          expect(docCacheSvc.getDoc('2').id).toBe('2');
          expect(docCacheSvc.getDoc('3').id).toBe('3');
          expect(docCacheSvc.getDoc('4').id).toBe('4');
          called++;
        });

      $rootScope.$apply();

      var mockResolver = docResolverSvc.mockResolver;
      expect(mockResolver.docs.length).toBe(1);
      expect(mockResolver.docs[0].id).toBe('4');
      expect(called).toBe(1);
    });

    it('resolves nothing on redundant ids', function() {
      checkSetupFromScratch();

      docCacheSvc.addIds(['1', '2', '3']);

      var called = 0;
      docCacheSvc.update(ignoredSettings)
        .then(function() {
          expect(docCacheSvc.getDoc('1').id).toBe('1');
          expect(docCacheSvc.getDoc('2').id).toBe('2');
          expect(docCacheSvc.getDoc('3').id).toBe('3');
          called++;
        });

      $rootScope.$apply();
      expect(called).toBe(1);
      var mockResolver = docResolverSvc.mockResolver;
      // We only resolve if there are docs to be resolved.  In this test
      // we have one new doc to be resolved so one match.
      expect(mockResolver.docs.length).toBe(3);
    });
    
    it('resolves partially ignoringredundant ids', function() {
      checkSetupFromScratch();

      docCacheSvc.addIds(['1', '2', '3', '4']);

      var called = 0;
      docCacheSvc.update(ignoredSettings)
        .then(function() {
          expect(docCacheSvc.getDoc('1').id).toBe('1');
          expect(docCacheSvc.getDoc('2').id).toBe('2');
          expect(docCacheSvc.getDoc('3').id).toBe('3');
          expect(docCacheSvc.getDoc('4').id).toBe('4');
          called++;
        });

      $rootScope.$apply();
      expect(called).toBe(1);
      var mockResolver = docResolverSvc.mockResolver;
      // We only resolved doc 4
      expect(mockResolver.docs.length).toBe(1);
    });
  });

  describe('invalidation and emptying', function() {
    it('invalidates and requeries', function() {
      checkSetupFromScratch();
      docCacheSvc.invalidate();
      checkSetupFromScratch();
    });

    it('forgets and requeries', function() {
      checkSetupFromScratch();
      docCacheSvc.empty();
      checkSetupFromScratch();
    });
  });
});
