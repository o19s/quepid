'use strict';

/* jslint latedef:false */

// Responsible for managing individual queries
// so its a starting point for a lot of functionality...
// .... (as you can tell by the dependencies)
angular.module('QuepidApp')
  .service('queriesSvc', [
    '$rootScope',
    '$http',
    '$q',
    '$log',
    'broadcastSvc',
    'scorerSvc',
    'qscoreSvc',
    'searchSvc',
    'ratingsStoreSvc',
    'caseTryNavSvc',
    'snapshotSearcherSvc',
    'bookSvc',
    'DocListFactory',
    'diffResultsSvc',
    'searchErrorTranslatorSvc',
    'esExplainExtractorSvc',
    'solrExplainExtractorSvc',
    'normalDocsSvc',
    function queriesSvc(
      $scope,
      $http,
      $q,
      $log,
      broadcastSvc,
      scorerSvc,
      qscoreSvc,
      searchSvc,
      ratingsStoreSvc,
      caseTryNavSvc,
      snapshotSearcherSvc,
      bookSvc,
      DocListFactory,
      diffResultsSvc,
      searchErrorTranslatorSvc,
      esExplainExtractorSvc,
      solrExplainExtractorSvc,
      normalDocsSvc
    ) {

      let caseNo = -1;
      let currSettings = {};
      this.error = false;
      let svcVersion = 0;

      let svc = this;
      this.displayOrder = [];
      this.queries = {};
      this.linkUrl = '';

      // Cache for tracking synced query-doc pairs per book
      // Format: { bookId: { 'queryText:docId': true } }
      let syncedPairsCache = {};

      svc.reset = reset;
      function reset() {
        svc.queries = {};
        svc.showOnlyRated = false;
        svc.svcVersion++;
        // Clear sync cache when resetting
        syncedPairsCache = {};
      }

      // Method to clear cache for a specific book
      this.clearSyncCache = function(bookId) {
        if (bookId && syncedPairsCache[bookId]) {
          delete syncedPairsCache[bookId];
          $log.debug('Cleared sync cache for book ' + bookId);
        }
      };

      // Method to get cache stats for debugging
      this.getSyncCacheStats = function(bookId) {
        if (bookId && syncedPairsCache[bookId]) {
          return {
            bookId: bookId,
            syncedPairsCount: Object.keys(syncedPairsCache[bookId]).length
          };
        }
        return null;
      };

      this.getCaseNo = getCaseNo;
      this.createSearcherFromSettings = createSearcherFromSettings;
      this.createSearcherFromSnapshot = createSearcherFromSnapshot;
      this.normalizeDocExplains = normalizeDocExplains;
      this.toggleShowOnlyRated = toggleShowOnlyRated;

      svc.bootstrapQueries = bootstrapQueries;
      svc.showOnlyRated = false;

      // Rescore on ratings update
      $scope.$on('rating-changed', () => {
        svc.scoreAll();
      });

      function createSearcherFromSettings(passedInSettings, query, options) {
        let queryText = query.queryText;
        let args = angular.copy(passedInSettings.selectedTry.args) || {};
        options = options == null ? {} : options;

        if (passedInSettings && passedInSettings.selectedTry) {

          let searcherOptions = {
            customHeaders: passedInSettings.customHeaders,
            escapeQuery:   passedInSettings.escapeQuery,
            numberOfRows:  passedInSettings.numberOfRows,
            basicAuthCredential: passedInSettings.basicAuthCredential
          };
          if (passedInSettings.apiMethod !== undefined) {
            searcherOptions.apiMethod = passedInSettings.apiMethod;
          }

          if (passedInSettings.proxyRequests === true) {
            searcherOptions.proxyUrl = caseTryNavSvc.getQuepidProxyUrl();
          }

          if (passedInSettings.searchEngine === 'static'){
            // Similar to logic in Splainer-searches SettingsValidatorFactory for snapshots.
            // we need a better way of handling this.   Basically we are saying a static search engine is
            // treated like Solr.   But if we have more generic search apis, they will need a
            // custom parser...
            passedInSettings.searchEngine = 'solr';
          }
          else if (passedInSettings.searchEngine === 'searchapi'){
            /*jshint evil:true */
            eval(passedInSettings.mapperCode);
            /*jshint evil:false */


            if (typeof docsMapper === 'function') {
              // jshint -W117
              searcherOptions.docsMapper = docsMapper;
            }
            if (typeof numberOfResultsMapper === 'function') {
              // jshint -W117
              searcherOptions.numberOfResultsMapper = numberOfResultsMapper;
            }
          }

          if (passedInSettings.searchEngine === 'solr') {
            // add echoParams=all if we don't have it defined to provide query details.
            if (args['echoParams'] === undefined) {
              args['echoParams'] = 'all';
            }
          }
          // Modify query if ratings were passed in
          if (options.filterToRated) {
            if (passedInSettings.searchEngine === 'es' || passedInSettings.searchEngine === 'os') {
              let mainQuery = args['query'];
              args['query'] = {
                'bool': {
                  'should': mainQuery,
                  'filter': query.filterToRatings(passedInSettings)
                }
              };
            } else if (passedInSettings.searchEngine === 'solr') {
              if (args['fq'] === undefined) {
                args['fq'] = [];
              }
              args['fq'].push(query.filterToRatings(passedInSettings));
            } else if (passedInSettings.searchEngine === 'vectara') {
              // currently doc id filtering frequently produces 0 results
              // args['query'] = args['query'].map(function addFilter(query) {
              //  query['metadata_filter'] = query.filterToRatings(passedInSettings);
              // });
            } else if (passedInSettings.searchEngine === 'algolia') {
              // Not supported
            }
          }

          // This is for Mattias!  Merge our query specific options in as "qOption"
          // which is what splainer-search expects.
          /*jshint ignore:start */
          searcherOptions.qOption = { ...passedInSettings.options, ...query.options};
          /*jshint ignore:end */


          return searchSvc.createSearcher(
            passedInSettings.createFieldSpec(),
            passedInSettings.selectedTry.searchUrl,
            args,
            queryText,
            searcherOptions,
            passedInSettings.searchEngine
          );
        }
      }

      function createSearcherFromSnapshot(snapshotId, query, settings) {
        return snapshotSearcherSvc.createSearcherFromSnapshot(snapshotId, query, settings);
      }

      function normalizeDocExplains(query, searcher, fieldSpec) {
        let normed = [];

        if (searcher.type === 'es' || searcher.type === 'os') {
          normed = esExplainExtractorSvc.docsWithExplainOther(searcher.docs, fieldSpec);
        } else if (searcher.type === 'solr') {
          normed = solrExplainExtractorSvc.docsWithExplainOther(searcher.docs, fieldSpec, searcher.othersExplained);
        } else {
          // search engine with no explain output
          normed = searcher.docs.map(function(doc) {
            return normalDocsSvc.createNormalDoc(fieldSpec, doc);
          });
        }

        let docs = [];
        angular.forEach(normed, function(doc) {
          docs.push(query.ratingsStore.createRateableDoc(doc));
        });

        return docs;
      }

      function toggleShowOnlyRated() {
        svc.showOnlyRated = !svc.showOnlyRated;

        if (svc.showOnlyRated) {
          angular.forEach(svc.queries, function(query) {
            if (!query.ratingsReady) {
              query.refreshRatedDocs();
            }
          });
        }
      }

      // ***********************************
      // An individual search query that
      // gets executed
      let Query = function(queryWithRatings) {
        let self    = this;

        let qt      = 'query_text';
        let version = 1;

        self.hasBeenScored  = false;
        self.docsSet        = false;
        self.allRated       = true;
        self.ratingsPromise = null;
        self.ratingsReady   = false;

        self.queryId        = queryWithRatings.queryId;
        self.caseNo         = caseNo;
        self.queryText      = queryWithRatings[qt];
        self.ratings        = {};
        self.docs           = [];
        self.ratedDocs      = [];
        self.ratedDocsFound = 0;
        self.numFound       = 0;
        self.options        = queryWithRatings.options == null ? {} : queryWithRatings.options;
        self.notes          = queryWithRatings.notes;
        self.modifiedAt      = queryWithRatings.modified_at;

        self.informationNeed = queryWithRatings.information_need;
        self.ratingVariance   = queryWithRatings.rating_variance;

        self.modified = queryWithRatings.updated_at;



        // Error
        self.errorText = '';

        self.ratings = queryWithRatings.ratings;
        if ( self.ratings === undefined ) {
          self.ratings = {};
        }

        self.ratingsStore = ratingsStoreSvc.createRatingsStore(
          caseNo,
          self.queryId,
          self.ratings
        );

        let resultsReturned = false;
        let that = this;

        that.setDirty = function() {
          version++;
          svcVersion++;
        };

        // Reflect updates to query or ratings that happen in
        // client side.
        this.touchModifiedAt = function() {
          this.modifiedAt = new Date().toISOString();
        };

        this.persisted = function() {
          return (this.queryId && this.queryId >= 0);
        };

        this.effectiveScorer = function() {
          let scorer = this.scorer;

          if (!scorer) {
          /* use the case default scorer if none
             set for this query */
            return scorerSvc.defaultScorer;
          } else {
            return scorer;
          }
        };

        // defaultCaseOrder is an index for this query using the default
        // order from the Quepid server
        this.defaultCaseOrder = 0;
        this.lastScore = 0; // the score of this query the last time it was tested
        this.lastScoreVersion = -5;

        this.scoreOthers = function(otherDocs) {

          let bestDocs  = this.ratingsStore.bestDocs();
          let scorer    = this.effectiveScorer();

          // The defaults are set below because sometimes quepid saves out scores with no values.
          // TODO: Defaults can be removed if the quepid scoring persistence issue is cleaned up
          let promise   = scorer.score(this, this.numFound, otherDocs, bestDocs, this.options) || 0.0;
          let maxScore  = scorer.maxScore() || 1.0;


          return promise.then(function(score) {

            // We want to flag missing ratings based on the scorer "k" property, not on the
            // number of documents returned by the query.
            let docsToCheck = that.docs.slice(0, that.depthOfRating);
            let allRated = true;
            let countMissingRatings = 0;

            angular.forEach(docsToCheck, function(doc) {
              if (!doc.hasRating()) {
                allRated = false;
                countMissingRatings = countMissingRatings + 1;
              }
            });

            let color     = qscoreSvc.scoreToColor(score, maxScore);

            return {
              score:                score || 0.0,
              maxScore:             maxScore,
              allRated:             allRated,
              countMissingRatings:  countMissingRatings,
              backgroundColor:      color
            };
          });
        };

        this.score = function() {
          if (this.lastScoreVersion === this.version()) {
            let deferred = $q.defer();
            deferred.resolve(this.currentScore);
            return deferred.promise;
          }

          return this.scoreOthers(this.docs)
            .then(function(score) {
              that.currentScore = score;

              that.hasBeenScored = true;

              that.lastScore    = that.currentScore.score || 0;

              that.allRated     = that.currentScore.allRated;

              that.lastScoreVersion = that.version();

              return that.currentScore;
            }
          );
        };

        this.fieldSpec = function() {
          return currSettings.createFieldSpec();
        };

        this.maxDocScore = function() {
          let maxDocScore = 0;
          angular.forEach(this.docs, function(doc) {
            maxDocScore = Math.max(doc.score(), maxDocScore);
          });
          return maxDocScore;
        };


        // This method allows scorers to wait on rated documents before trying to score
        this.awaitRatedDocs = function() {
          let deferred = $q.defer();

          // Immediately resolve if the docs are ready
          if (this.ratingsReady) {
            deferred.resolve();
          // Waiting on an existing promise
          } else if (self.ratingsPromise) {
            self.ratingsPromise.then(function() {
              deferred.resolve();
            });
          // Setup a new promise
          } else {
            self.ratingsPromise = this.refreshRatedDocs()
              .then(function() {
              deferred.resolve();
            });
          }

          return deferred.promise;
        };


        this.refreshRatedDocs = function(pageSize) {
          let settings = angular.copy(currSettings);

          if (pageSize) {
            settings.numberOfRows = pageSize;
          }

          self.ratedSearcher = svc.createSearcherFromSettings(
              settings,
              self,
              { filterToRated: true }
            );

          let ratedDocsStaging = [];
          return self.ratedSearcher.search().then(function() {
            self.ratedUrl = self.ratedSearcher.linkUrl;

            let normed = normalizeDocExplains(self, self.ratedSearcher, currSettings.createFieldSpec());

            angular.forEach(normed, function(doc) {
              let rateableDoc = self.ratingsStore.createRateableDoc(doc);
              ratedDocsStaging.push(rateableDoc);
            });

            self.ratedDocs = ratedDocsStaging;
            self.ratedDocsFound = normed.length;
            self.ratingsReady = true;
            self.ratingsPromise = null;
          });
        };

        this.setDocs = function(newDocs, numFound) {
          that.docs.length = 0;
          that.numFound    = numFound;
          resultsReturned  = true;
          that.errorText   = '';
          that.setDirty();

          let fieldSpec = currSettings.createFieldSpec();
          let error     = false;
          let docList   = new DocListFactory(
            newDocs,
            fieldSpec,
            that.ratingsStore
          );

          that.docs = docList.list();

          if (docList.hasErrors()) {
            error = docList.errorMsg();
            that.onError(docList.errorMsg());
          }

          that.docsSet = true;

          return error;
        };

        this.onError = function(errorText) {
          that.errorText = errorText;
        };

        this.browseUrl = function() {
          if (svc.showOnlyRated) {
            return that.ratedUrl;
          } else {
            return that.linkUrl;
          }
        };

        this.version = function() {
          return version + this.ratingsStore.version();
        };

        this.search = function() {
          let self = this;

          return $q(function(resolve, reject) {
            self.hasBeenScored = false;

            self.searcher = svc.createSearcherFromSettings(
              currSettings,
              self
            );

            self.ratedSearcher = svc.createSearcherFromSettings(
              currSettings,
              self,
              { filterToRated: true }
            );

            resultsReturned = false;

            let promises = [];

            promises.push(self.searcher.search()
              .then(function() {
                            }, function(response) {
                self.linkUrl = self.searcher.linkUrl;
                self.setDocs([], 0);

                let msg = searchErrorTranslatorSvc.parseResponseObject(response, self.searcher.linkUrl, currSettings.searchEngine);

                self.onError(msg);
                reject(msg);
              }).catch(function(response) {
                $log.debug('Failed to load search results');
                return response;
              }));


            // This is okay for smaller cases but bogs down the app for 100's of queries
            //promises.push(self.refreshRatedDocs());

            $q.all(promises).then( () => {
              self.linkUrl = self.searcher.linkUrl;

              if (self.searcher.inError) {
                //self.docs.length = 0;
                self.setDocs([], 0);
                self.onError('Please click browse to see the error');
              } else {
                let error = self.setDocs(self.searcher.docs, self.searcher.numFound);
                if (error) {
                  self.onError(error);
                  reject(error);
                } else {
                  self.othersExplained = self.searcher.othersExplained;

                  resolve();

                }
              }
            });
          });
        };

        // Method to search using a snapshot instead of live search engine
        this.searchFromSnapshot = function(snapshotId) {
          let self = this;
          
          return $q(function(resolve, reject) {
            self.hasBeenScored = false;

            // Create snapshot searcher using the same interface as normal searchers
            let settings = currSettings;
            self.searcher = svc.createSearcherFromSnapshot(snapshotId, self, settings);

            if (!self.searcher) {
              let msg = 'Snapshot not found: ' + snapshotId;
              self.onError(msg);
              reject(msg);
              return;
            }

            // Use the same search flow as normal search
            self.searcher.search()
              .then(function() {
                self.linkUrl = self.searcher.linkUrl;

                if (self.searcher.inError) {
                  self.setDocs([], 0);
                  self.onError('Error loading snapshot results');
                  reject('Error loading snapshot results');
                } else {
                  let error = self.setDocs(self.searcher.docs, self.searcher.numFound);
                  if (error) {
                    self.onError(error);
                    reject(error);
                  } else {
                    resolve();
                  }
                }
              }, function() {
                let msg = 'Failed to load snapshot: ' + snapshotId;
                self.onError(msg);
                reject(msg);
              });
          });
        };

        this.paginate = function() {
          let self = this;

          if (self.searcher === null) {
            return;
          }

          self.searcher = self.searcher.pager();

          return self.searcher.search()
            .then(function() {
              let ratingsStore  = self.ratingsStore;
              let docs          = self.searcher.docs;
              let fieldSpec     = currSettings.createFieldSpec();
              let docList       = new DocListFactory(docs, fieldSpec, ratingsStore);
              self.docs         = self.docs.concat(docList.list());
            }, function(response) {
              $log.debug('Failed to load search: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to load search');
              return response;
            });
        };

        this.ratedPaginate = function() {
            let self = this;

            if (self.ratedSearcher === null) {
              return;
            }

            self.ratedSearcher = self.ratedSearcher.pager();
            return self.ratedSearcher.search()
              .then(function() {
                let normed = svc.normalizeDocExplains(self, self.ratedSearcher, currSettings.createFieldSpec());
                self.ratedDocs = self.ratedDocs.concat(normed);
              });
        };

        this.saveNotes = function(notes, informationNeed) {
          var that = this;
          var notesJson = { query: { notes: notes, information_need: informationNeed} };
          var url = 'api/cases/' + caseNo + '/queries/' + that.queryId + '/notes';

          return $http.put(url , notesJson)
            .then(function() {
              that.notes = notes;
              that.informationNeed = informationNeed;
            }, function(response) {
              $log.debug('Failed to save notes: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to save notes');
              return response;
            });
        };

        this.fetchNotes = function() {
          var that  = this;
          var url   = 'api/cases/' + caseNo + '/queries/' + that.queryId + '/notes';
          return $http.get(url)
            .then(function(response) {
              that.notes = response.data.notes;
              that.informationNeed = response.data.information_need;
            }, function(response) {
              $log.debug('Failed to load notes: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to fetch notes');
              return response;
            });
        };

        this.saveOptions = function(options) {
          var that = this;
          var optionsJson = { query: { options: options } };
          var url = 'api/cases/' + caseNo + '/queries/' + that.queryId + '/options';

          return $http.put(url , optionsJson)
            .then(function() {
              that.options = options;

              that.setDirty();
            }, function(response) {
              $log.debug('Failed to save options: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to save options');
              return response;
            });
        };

        this.fetchOptions = function() {
          var that  = this;
          var url   = 'api/cases/' + caseNo + '/queries/' + that.queryId + '/options';

          return $http.get(url)
            .then(function(response) {
              that.options = JSON.parse(response.data.options);
            }, function(response) {
              $log.debug('Failed to load options: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to fetch options');
              return response;
            });
        };

        this.reset = function() {
          this.errorText = '';
          resultsReturned = false;
          this.docs.length = 0;
        };

        this.state = function() {
          if (this.errorText.length > 0) {
            return 'error';
          }
          if (!resultsReturned) {
            return 'loading';
          }
          else if (this.docs.length === 0 && this.errorText === '') {
            return 'noResults';
          }
          else {
            return 'loaded';
          }
        };

        this.searchAndScore = function() {
          return this.search().then( () => {
            this.score();
            
            // Sync query results to associated Book if one exists
            svc.syncToBook();
          });
        };

        this.filterToRatings = function(settings, slice) {
          let ratedIDs = self.ratings ? Object.keys(self.ratings) : [];

          // Explain other cannot page thru results, this allows for retrieving slices of the ratings
          if (slice !== undefined) {
            ratedIDs = ratedIDs.slice(slice, settings.numberOfRows + slice);
          }

          let fieldSpec = settings.createFieldSpec();

          if (settings.searchEngine === 'es' || settings.searchEngine === 'os') {
            let esQuery = {
              'terms': {}
            };
            esQuery['terms'][fieldSpec.id] = ratedIDs;
            return esQuery;
          } else if (settings.searchEngine === 'solr') {
            return '{!terms f=' + fieldSpec.id + '}' + ratedIDs.join(',');
          } else if (settings.searchEngine === 'vectara') {
            return ratedIDs.map(function(id) {
              return 'doc.id = \'' + id + '\'';
            }).join(' OR ');
          }
        };
      };

      this.QueryFactory = Query;

      this.hasUnscoredQueries = function() {
        return this.unscoredQueryCount() > 0;
      };

      this.unscoredQueryCount = function() {
        return Object.values(this.queries).filter( (q) => {
          return !q.hasBeenScored;
        }).length;
      };

      this.scoredQueryCount = function() {
        return Object.values(this.queries).filter ( (q) => {
          return q.hasBeenScored;
        }).length;
      };

      this.queryCount = function() {
        return Object.keys(this.queries).length;
      };

      let that = this;
      let addQueriesFromResp = function(data) {
        // Update the display order
        svcVersion++;
        that.displayOrder = data.display_order;

        // Parse query array
        let newQueries = [];
        angular.forEach(data.queries, function(queryWithRatings) {
          let newQuery = null;
          if (!(queryWithRatings.hasOwnProperty('deleted') &&
                queryWithRatings.deleted === 'true')) {
            let newQueryId = queryWithRatings.query_id;
            queryWithRatings.queryId = queryWithRatings.query_id;
            // Eric thinks below is not needed.
            //if (typeof(queryWithRatings.queryId) === 'string') {
            //  queryWithRatings.queryId = parseInt(queryWithRatings.queryId, 10);
            //}
            newQuery = new Query(queryWithRatings);
            that.queries[newQueryId] = newQuery;
            newQueries.push(newQueryId);
            diffResultsSvc.createQueryDiff(newQuery);
            // diff creation is now handled by diffResultsSvc
          }
        });

        return newQueries;
      };

      let querySearchableDeferred = $q.defer();
      function bootstrapQueries(caseNo) {
        querySearchableDeferred = $q.defer();
        var path = 'api/cases/' + caseNo + '/queries?bootstrap=true';

        $http.get(path)
          .then(function(response) {
            that.queries = {};
            addQueriesFromResp(response.data);

            querySearchableDeferred.resolve();
          }, function(response) {
            $log.debug('Failed to bootstrap queries: ', response);
            return response;
          }).catch(function(response) {
            $log.debug('Failed to bootstrap queries');
            return response;
          });

        return querySearchableDeferred.promise;
      }

      this.querySearchReady = function() {
        $log.debug('PROMISE subscribed...');
        return querySearchableDeferred.promise;
      };

      this.querySearchPromiseReset = function() {
        $log.debug('PROMISE reset...');
        querySearchableDeferred = $q.defer();
      };

      this.changeSettings = function(newCaseNo, newSettings) {
        currSettings = newSettings;

        if (caseNo !== newCaseNo) {
          // Clear sync cache when switching cases
          syncedPairsCache = {};
          scorerSvc.bootstrap(newCaseNo);
          bootstrapQueries(newCaseNo);
        } else {
          angular.forEach(this.queries, function(query) {
            // TODO update settings for diffs
            if (query.diff !== null) {
              query.diff.fetch();
            }
          });
          querySearchableDeferred.resolve();
        }

        caseNo = newCaseNo;
        return querySearchableDeferred.promise;
      };

      this.pAll = async function (queue, concurrency) {
        let index = 0;
        const results = [];

        const worker = async () => {
          while (index < queue.length) {
            const curIndex = index++;
            const promise = queue[curIndex]();
            await promise;
            results[curIndex] = promise;
          }
        };

        const workers = [];
        for (let workerIdx = 0; workerIdx < concurrency; workerIdx++) {
          workers.push(worker());
        }
        await Promise.all(workers);
        return Promise.all(results);
      };

      this.searchAll = function() {
        let promises = [];
        let scorePromises = [];

        angular.forEach(this.queries, function(query) {
          let searchPromiseFn = () => query.search().then(() => {
            scorePromises.push(query.score());
          });

          promises.push(searchPromiseFn);
        });

        // Holy nested promises batman
        return this.pAll(promises, 10).then( () => {
          $q.all(scorePromises).then( () => {
            /*
             * Why are we calling scoreAll after we called score() above?
             *
             * Score just runs the scorer on each query
             * scoreAll prepares the aggregation score for all queries (also runs scores if needed)
             * but knows not to run anything if things haven't changed.
             *
             * We have the split here so the progress bar progresses instead of flying thru
             * after all searches complete.
             */
            svc.scoreAll();

            // Sync query results to associated Book if one exists
            svc.syncToBook();
          });
        });
      };

      // the try that the query results reflect
      this.displayedTryNo = function() {
        return currSettings.selectedTry.tryNo;
      };

      this.createQuery = function(queryText) {
        let queryJson = {
          'query_text': queryText,
          queryId:      -1
        };
        let newQuery = new Query(queryJson);
        diffResultsSvc.createQueryDiff(newQuery);
        // diff creation is now handled by diffResultsSvc
        return newQuery;
      };

      this.persistQuery = function(query) {
        let self = this;

        return $q(function(resolve, reject) {
          if (query.persisted()) {
            resolve();
            return;
          }

          var path = 'api/cases/' + caseNo + '/queries';
          var postData = {
            query: {
              query_text: query.queryText
            }
          };

          $http.post(path, postData)
            .then(function(response) {
              let data = response.data;
              if ( response.status === 204 ) {
                // This typically happens when the query already exists, so
                // no change happened
                resolve();
              } else {
                // Update the display order based on the new one after the query creation
                self.displayOrder = data.display_order;

                // Eric thinks we should be running this through a factory to map api to front end...
                let addedQuery = data.query;
                addedQuery.queryId = addedQuery.query_id;

                query.queryId = addedQuery.query_id;
                query.ratingsStore.setQueryId(addedQuery.queryId);

                self.queries[query.queryId] = query;
                svcVersion++;
                //broadcastSvc.send('updatedQueriesList');

                resolve();
              }
            }, function(response) {
              let data = response.data;
              reject(data);
            }).catch(function(response) {
              $log.debug('Failed to persist query');
              return response;
            });
        });
      };

      this.persistQueries = function(queries) {
        let deferred = $q.defer();

        let queryTexts = [];
        angular.forEach(queries, function(query) {
          if ( !query.persisted() ) {
            queryTexts.push(query.queryText);
          }
        });

        if ( queryTexts.length === 0 ) {
          deferred.resolve();
          return deferred.promise;
        }

        var path = 'api/bulk/cases/' + caseNo + '/queries';
        var data = {
          queries: queryTexts
        };

        let that = this;
        $http.post(path, data)
          .then(function(response) {
            let data = response.data;

            // Update the display order based on the new one after the query creation
            that.queries = {};
            addQueriesFromResp(data);
            deferred.resolve();
        }, function(response) {
            let data = response.data;
            deferred.reject(data);
          }).catch(function(response) {
            $log.debug('Failed to persist queries');
            return response;
          });

        return deferred.promise;
      };

      // get the full list of queries sorted by create/manual order
      // only call this when our version() changes
      this.queryArray = function() {
        let rVal = [];

        for (let displayIter = 0; displayIter < this.displayOrder.length; ++displayIter) {
          let currQueryId = this.displayOrder[displayIter];
          if (this.queries.hasOwnProperty(currQueryId)) {
            this.queries[currQueryId].defaultCaseOrder = displayIter;
            rVal.push(this.queries[currQueryId]);
          }
        }
        return rVal;
      };

      this.updateQueryDisplayPosition = function(queryId, oldQueryId, reverse) {
        var url     = 'api/cases/' + caseNo + '/queries/' + queryId + '/position';
        var data    = {
          after:    oldQueryId,
          reverse:  reverse
        };

        return $http.put(url, data)
          .then(function(response) {
            svc.displayOrder = response.data.display_order;
            svcVersion++;
          }, function() {
            svcVersion++;
          }).catch(function(response) {
            $log.debug('Failed to update query display position');
            return response;
          });
      };

      // Delete a query
      this.deleteQuery = function(queryId) {
        var path = 'api/cases/' + caseNo + '/queries/' + queryId;
        var that = this;

        return $http.delete(path)
          .then(function() {
            delete that.queries[queryId];
            svcVersion++;
          }, function(response) {
            $log.debug('Failed to delete query: ', response);
            return response;
          }).catch(function(response) {
            $log.debug('Failed to delete query');
            return response;
          });
      };

      // Move a query
      this.moveQuery = function(query, targetCase) {
        var path = 'api/cases/' + query.caseNo + '/queries/' + query.queryId;
        var data = {'other_case_id': targetCase.caseNo};

        return $http.put(path, data)
          .then(function() {
            delete that.queries[query.queryId];
            svcVersion++;
          }, function(response) {
            $log.info('failed to move query');
            return response;
          }).catch(function(response) {
            $log.debug('Failed to move query');
            return response;
          });
      };

      this.version = function() {
        return svcVersion + ratingsStoreSvc.version();
      };

      /*
       * This method prepares the scores table that the qgraph/qscore-case/qscore-query components need.
       *
       */
      this.scoreAll = function(scorables) {
        let avg = null;
        let tot = 0;
        let allRated = true;
        if (scorables === undefined) {
          scorables = this.queries;
        }

        let queryScores =  {};

        let promises = [];
        angular.forEach(scorables, function(scorable) {
          promises.push(scorable.score().then(function(scoreInfo) {
            if (!scoreInfo.allRated) {
              allRated = false;
            }
            
            if (scoreInfo.score === null) {
              // Handle null scores gracefully in diff/snapshot comparisons
              console.log('Skipping null score in scoreAll calculation');
              return; // Skip this scorable and continue with others
            }
            // Treat non-rated queries as zeroes when calculating case score
            // This if means we are skipping over zsr as part of the case score
            if (scoreInfo.score !== 'zsr' && scoreInfo.score !== '--'){
            //if (scoreInfo.score !== 'zsr'){
              // Treat non-rated queries as zeroes when calculating case score
            //   avg += scoreInfo.score === '--' ? 0 : scoreInfo.score;
            //  tot++;
              avg += scoreInfo.score;
              tot++;
            }
            // include this else statement to have zsr and non rated count as a zero against the case score.
            //else {
            //  avg +=  0
            //  tot++;
            //}
            //TODO: make text be queryText
            queryScores[scorable.queryId] = {
              score:    scoreInfo.score,
              maxScore: scoreInfo.maxScore,
              text:     scorable.queryText,
              numFound: scorable.numFound,
            };
            
            return scoreInfo;
          }));
        });

        return $q.all(promises).then(function() {
          if (tot > 0) {
            avg = avg/tot;
          }
          else {
            // we have no rated queries, everything is zsr or --, so mark at case level --
            avg = '--';
          }

          svc.latestScoreInfo = {
            'allRated': allRated,
            'score':    avg,
            'queries':  queryScores,
          };

          $scope.$emit('scoring-complete');

          return svc.latestScoreInfo;
        });
      };

      // Refresh diff objects for all queries after state changes
      this.refreshAllDiffs = function() {
        angular.forEach(this.queries, function(query) {
          diffResultsSvc.createQueryDiff(query);
        });
      };

      // Backward compatibility methods - delegate to refreshAllDiffs
      this.setDiffSetting = function(diffSetting) {
        this.refreshAllDiffs();
      };

      this.setMultiDiffSetting = function(diffSettings) {
        this.refreshAllDiffs();
      };

      this.scoreAllDiffs = function() {
        let diffs = [];
        angular.forEach(this.queries, function(query) {
          if (query.diff !== null) {
            diffs.push(query.diff);
          }
        });

        return this.scoreAll(diffs);
      };

      this.updateScores = function() {
        angular.forEach(this.queries, function(query) {
          query.setDirty();
        });

        svc.scoreAll().then(function() {
          svcVersion++;
        });
      };

      this.syncToBook = function() {
        // Only sync if we have a case with a book associated
        if (!caseNo || caseNo === -1) {
          return;
        }

        // First check if this case has a book associated
        var checkPath = 'api/cases/' + caseNo;
        $http.get(checkPath).then(function(response) {
          var theCase = response.data;
          if (!theCase.book_id) {
            return; // No book associated with this case
          }

          var bookId = theCase.book_id;

          // Initialize cache for this book if not exists
          if (!syncedPairsCache[bookId]) {
            syncedPairsCache[bookId] = {};
          }

          // Filter queries to only include those with new/unsynced results
          let queriesToSync = [];
          angular.forEach(svc.queries, function(query) {
            if (query.docs && query.docs.length > 0) {
              // Create a modified query with only unsynced docs
              let unsyncedDocs = [];
              let hasUnsyncedDocs = false;

              angular.forEach(query.docs, function(doc) {
                var cacheKey = query.queryText + ':' + doc.id;
                if (!syncedPairsCache[bookId][cacheKey]) {
                  unsyncedDocs.push(doc);
                  hasUnsyncedDocs = true;
                  // Mark as synced (optimistically)
                  syncedPairsCache[bookId][cacheKey] = true;
                }
              });

              // Only include query if it has unsynced docs
              if (hasUnsyncedDocs) {
                // Create a shallow copy of the query with only unsynced docs
                var queryToSync = {
                  queryText: query.queryText,
                  informationNeed: query.informationNeed,
                  notes: query.notes,
                  docs: unsyncedDocs
                };
                queriesToSync.push(queryToSync);
              }
            }
          });

          // Process queries in batches of 100
          var batchSize = 100;
          var totalBatches = Math.ceil(queriesToSync.length / batchSize);
          var batchPromises = [];

          for (var i = 0; i < totalBatches; i++) {
            var startIdx = i * batchSize;
            var endIdx = Math.min(startIdx + batchSize, queriesToSync.length);
            var batch = queriesToSync.slice(startIdx, endIdx);

            if (batch.length > 0) {
              // Create a promise for each batch with proper closure
              // Use IIFE to capture all variables to prevent closure issues
              var batchPromise = (function(currentBookSvc, currentBookId, currentCaseNo, currentBatch, currentSyncedPairsCache, currentLogger) {
                return currentBookSvc.updateQueryDocPairs(currentBookId, currentCaseNo, currentBatch)
                  .then(function() {
                   
                  }, function(error) {
                    // On error, remove the failed items from cache so they can be retried
                    angular.forEach(currentBatch, function(query) {
                      angular.forEach(query.docs, function(doc) {
                        var cacheKey = query.queryText + ':' + doc.id;
                        delete currentSyncedPairsCache[currentBookId][cacheKey];
                      });
                    });
                    currentLogger.error('Failed to sync book query_doc_pairs batch:', error);
                  });
              })(bookSvc, bookId, caseNo, batch, syncedPairsCache, $log);

              batchPromises.push(batchPromise);
            }
          }

          // Wait for all batches to complete
          if (batchPromises.length > 0) {
            $q.all(batchPromises).then(function() {
              $log.debug('All book sync batches completed. Total pairs synced: ' + Object.keys(syncedPairsCache[bookId]).length);
            });
          } else {
            $log.debug('No new query-doc pairs to sync for book ' + bookId);
          }
        }, function(error) {
          $log.error('Failed to fetch case details:', error);
        });
      };

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }
    }
  ]);
