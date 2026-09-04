'use strict';

describe('Service: searchEndpointSvc', function () {

  // load the service's module
  beforeEach(module('QuepidApp'));

  var searchEndpointSvc;

  beforeEach(function() {
    inject(function(_searchEndpointSvc_) {
      searchEndpointSvc = _searchEndpointSvc_;
    });
  });

  describe('isEsOrOsEngine', function() {
    it('is true for es and os', function() {
      expect(searchEndpointSvc.isEsOrOsEngine('es')).toBe(true);
      expect(searchEndpointSvc.isEsOrOsEngine('os')).toBe(true);
    });

    it('is false for solr, vectara, algolia, and other engines', function() {
      expect(searchEndpointSvc.isEsOrOsEngine('solr')).toBe(false);
      expect(searchEndpointSvc.isEsOrOsEngine('vectara')).toBe(false);
      expect(searchEndpointSvc.isEsOrOsEngine('algolia')).toBe(false);
      expect(searchEndpointSvc.isEsOrOsEngine('searchapi')).toBe(false);
    });
  });

  describe('usesJsonQueryParams', function() {
    it('is true for es, os, vectara, and algolia', function() {
      expect(searchEndpointSvc.usesJsonQueryParams('es')).toBe(true);
      expect(searchEndpointSvc.usesJsonQueryParams('os')).toBe(true);
      expect(searchEndpointSvc.usesJsonQueryParams('vectara')).toBe(true);
      expect(searchEndpointSvc.usesJsonQueryParams('algolia')).toBe(true);
    });

    it('is false for solr and other engines', function() {
      expect(searchEndpointSvc.usesJsonQueryParams('solr')).toBe(false);
      expect(searchEndpointSvc.usesJsonQueryParams('searchapi')).toBe(false);
    });
  });

});
