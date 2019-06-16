'use strict';

angular.module('QuepidApp')
  .service('bestFetcherSvc', [
    'docCacheSvc',
    function bestFetcherSvc(docCacheSvc) {
      var BestFetcher = function(ratingsStore) {
        this.docs = [];

        var that = this;

        this.version = function() {
          return ratingsStore.version();
        };

        this.fetch = function(settings) {
          var ids       = [];
          var bestDocs  = ratingsStore.bestDocs(settings.numberOfRows);
          angular.forEach(bestDocs, function(bestDoc) {
            ids.push(bestDoc.id);
          });

          docCacheSvc.addIds(ids);

          return docCacheSvc.update(settings)
            .then(function() {
              // shadow the resolvers docs & sort on rating
              that.docs.length = 0;

              angular.forEach(ids, function(id) {
                var doc = docCacheSvc.getDoc(id);

                if ( !doc ) { return; }

                doc.score = function() { return 0.0; };

                that.docs.push(ratingsStore.createRateableDoc(doc));
              });

              that.docs.sort(function(docA, docB) {
                return docB.getRating() - docA.getRating();
              });
            }, function(response) {
              console.log('Got an error from docCacheSvc.update: ', response);
              return response;
            })
            .catch(function(response) {
              console.log('Got an error from docCacheSvc.update: ', response);
              return response;
            });
        };

        this.name = function() {
          return 'Target Results';
        };
      };

      this.createBestFetcher = function(ratingsStore) {
        return new BestFetcher(ratingsStore);
      };
    }
  ]);
