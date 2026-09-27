'use strict';

angular.module('QuepidApp')
  .service('docCacheSvc', [
    '$q',
    '$log',
    'docResolverSvc',
    'caseTryNavSvc',
    function docCacheSvc(
      $q,
      $log,
      docResolverSvc,
      caseTryNavSvc
    ) {
      var docCache = {};
      var scopedDocCaches = {};

      var cacheFor = function(scope) {
        if (angular.isUndefined(scope) || scope === null) {
          return docCache;
        }

        var scopeKey = '' + scope;
        scopedDocCaches[scopeKey] = scopedDocCaches[scopeKey] || {};
        return scopedDocCaches[scopeKey];
      };

      this.addIds = function(moreIds, scope) {
        var cache = cacheFor(scope);
        angular.forEach(moreIds, function(id) {
          if (!Object.prototype.hasOwnProperty.call(cache, id)) {
            cache[id] = null;
          }
        });
      };

      this.getDoc = function(id, scope) {
        return cacheFor(scope)[id];
      };

      this.hasDoc = function(id, scope) {
        return this.knowsDoc(id, scope) && cacheFor(scope)[id] !== null;
      };

      this.knowsDoc = function(id, scope) {
        return Object.prototype.hasOwnProperty.call(cacheFor(scope), id);
      };

      this.empty = function(scope) {
        if (angular.isUndefined(scope) || scope === null) {
          docCache = {};
        } else {
          delete scopedDocCaches['' + scope];
        }
      };

      this.invalidate = function(scope) {
        var cache = cacheFor(scope);
        angular.forEach(Object.keys(cache), function(docId) {
          cache[docId] = null;
        });
      };

      // rebuild on new settings
      this.update = function(settings, scope) {
        var cache = cacheFor(scope);
        var docsToFetch = {};

        angular.forEach(cache, function(doc, docId) {
          if (doc === null) {
            docsToFetch[docId] = null;
          }
        });

        if (settings.proxyRequests === true){
          // Pass in the Quepid specific proxy url
          settings.proxyUrl = caseTryNavSvc.getQuepidProxyUrl(settings.searchEndpointId);
        }

        var docIds    = Object.keys(docsToFetch);

        if ( docIds.length > 0 ) {           
            var resolver  = docResolverSvc.createResolver(docIds, settings, 15);
            return resolver.fetchDocs()
            .then(function () {
              angular.forEach(resolver.docs, function (doc) {
                cache[doc.id] = doc;
              });
            }, function(response) {
              $log.info('Error fetching Docs in docCacheSvc: ', response);
              return response;
            })
            .catch(function(response) {
              $log.info('Got an error from docCacheSvc: ', response);
              return response;
            });
        } else {
          return $q(function(resolve) {
            resolve();
          });
        }
      };
    }
  ]);
