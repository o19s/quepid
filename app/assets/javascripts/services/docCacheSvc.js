'use strict';

angular.module('QuepidApp')
  .service('docCacheSvc', [
    '$q',
    'docResolverSvc',
    function docCacheSvc($q, docResolverSvc) {
      var docCache = {};

      this.addIds = function(moreIds) {
        angular.forEach(moreIds, function(id) {
          if (!docCache.hasOwnProperty(id)) {
            docCache[id] = null;
          }
        });
      };

      this.getDoc = function(id) {
        return docCache[id];
      };

      this.hasDoc = function(id) {
        return this.knowsDoc(id) && docCache[id] !== null;
      };

      this.knowsDoc = function(id) {
        return docCache.hasOwnProperty(id);
      };

      this.empty = function() {
        docCache = {};
      };

      this.invalidate = function() {
        angular.forEach(Object.keys(docCache), function(docId) {
          docCache[docId] = null;
        });
      };

      // rebuild on new settings
      this.update = function(settings) {
        var docsToFetch = {};

        angular.forEach(docCache, function(doc, docId) {
          if (doc === null) {
            docsToFetch[docId] = null;
          }
        });

        var docIds    = Object.keys(docsToFetch);
        var resolver  = docResolverSvc.createResolver(docIds, settings, 15);

        if ( docIds.length > 0 ) {
          return resolver.fetchDocs()
            .then(function () {
              angular.forEach(resolver.docs, function (doc) {
                docCache[doc.id] = doc;
              });
            }, function(response) {
              console.log('Error fetching Docs in docCacheSvc: ', response);
              return response;
            })
            .catch(function(response) {
              console.log('Got an error from docCacheSvc: ', response);
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
