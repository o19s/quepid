'use strict';

/*jslint latedef:false*/

// Responsible for managing individual queries
// so its a starting point for a lot of functionality...
// .... (as you can tell by the dependencies)
angular.module('QuepidApp')
  .service('queriesSvc', [
    '$rootScope',
    '$http',
    '$timeout',
    '$q',
    '$log',
    '$sce',
    'broadcastSvc',
    'caseTryNavSvc',
    'customScorerSvc',
    'qscoreSvc',
    'searchSvc',
    'solrUrlSvc',
    'ratingsStoreSvc',
    'DocListFactory',
    'diffResultsSvc',
    'searchErrorTranslatorSvc',
    'esExplainExtractorSvc',
    'solrExplainExtractorSvc',
    function queriesSvc(
      $scope,
      $http,
      $timeout,
      $q,
      $log,
      $sce,
      broadcastSvc,
      caseTryNavSvc,
      customScorerSvc,
      qscoreSvc,
      searchSvc,
      solrUrlSvc,
      ratingsStoreSvc,
      DocListFactory,
      diffResultsSvc,
      searchErrorTranslatorSvc,
      esExplainExtractorSvc,
      solrExplainExtractorSvc
    ) {

      var caseNo = -1;
      var currSettings = {};
      this.error = false;
      var svcVersion = 0;

      var svc = this;
      this.displayOrder = [];
      this.queries = {};
      this.linkUrl = '';

      svc.reset = reset;
      function reset() {
        svc.queries = {};
        svc.showOnlyRated = false;
        svc.svcVersion++;
      }

      this.getCaseNo = getCaseNo;
      this.createSearcherFromSettings = createSearcherFromSettings;
      this.normalizeDocExplains = normalizeDocExplains;
      this.toggleShowOnlyRated = toggleShowOnlyRated;

      svc.bootstrapQueries = bootstrapQueries;
      svc.showOnlyRated = false;

      // Rescore on ratings update
      $scope.$on('rating-changed', () => {
        svc.scoreAll();
      });

      function createSearcherFromSettings(passedInSettings, queryText, query) {
        var args = angular.copy(passedInSettings.selectedTry.args);

        if (passedInSettings && passedInSettings.selectedTry) {
          // Modify query if ratings were passed in
          if (query) {
            if (passedInSettings.searchEngine === 'es') {
              var mainQuery = args['query'];
              args['query'] = {
                'bool': {
                  'should': mainQuery,
                  'filter': query.filterToRatings(passedInSettings)
                }
              };
            } else {
              if (args['fq'] === undefined) {
                args['fq'] = [];
              }
              args['fq'].push(query.filterToRatings(passedInSettings));
            }

          }


          return searchSvc.createSearcher(
            passedInSettings.createFieldSpec(),
            passedInSettings.selectedTry.searchUrl,
            args,
            queryText,
            {
              escapeQuery:   passedInSettings.escapeQuery,
              numberOfRows:  passedInSettings.numberOfRows,
            },
            passedInSettings.searchEngine
          );
        }
      }

      function normalizeDocExplains(query, searcher, fieldSpec) {
        var normed = [];

        if (searcher.type === 'es') {
          normed = esExplainExtractorSvc.docsWithExplainOther(searcher.docs, fieldSpec);
        } else {
          normed = solrExplainExtractorSvc.docsWithExplainOther(searcher.docs, fieldSpec, searcher.othersExplained);
        }

        var docs = [];
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
      var Query = function(queryWithRatings) {
        var self    = this;

        var qt      = 'query_text';
        var version = 1;

        self.hasBeenScored  = false;
        self.docsSet        = false;
        self.allRated       = true;
        self.ratingsPromise = null;
        self.ratingsReady   = false;

        self.queryId        = queryWithRatings.queryId;
        self.caseNo         = caseNo;
        self.queryText      = queryWithRatings[qt];
        self.ratings        = {};
        self.scorerId       = null;
        self.scorerEnbl     = false;
        self.scorer         = null;
        self.docs           = [];
        self.ratedDocs      = [];
        self.ratedDocsFound = 0;
        self.numFound       = 0;
        self.test           = null;
        self.options        = {};
        self.notes          = queryWithRatings.notes;


        // Threshold properties
        self.threshold        = queryWithRatings.threshold;
        self.thresholdEnabled = queryWithRatings.thresholdEnabled;

        // Error
        self.errorText = '';

        // Set the query options
        if (
          queryWithRatings.hasOwnProperty('options') &&
          queryWithRatings.options !== '' &&
          queryWithRatings.options !== null
        ) {
          self.options  = JSON.parse(queryWithRatings.options);
        }

        // Figure out if the query has a custom scorer
        if (queryWithRatings.hasOwnProperty('scorerId')) {
          if (angular.isString(queryWithRatings.scorerId)) {
            self.scorerId = parseInt(queryWithRatings.scorerId, 10);
          } else {
            self.scorerId = queryWithRatings.scorerId;
          }
        }

        // Figure out if the query has a test scorer
        if (queryWithRatings.hasOwnProperty('test')) {
          self.test = customScorerSvc.constructFromData(queryWithRatings.test);
        }

        // If scorer is enabled,  set it
        if (queryWithRatings.hasOwnProperty('scorerEnbl') && queryWithRatings.scorerEnbl) {
          if ( self.test !== null && self.test.scorerId === self.scorerId ) {
            self.scorer     = self.test;
            self.scorerEnbl = true;
          } else if (queryWithRatings.scorer) {
            self.scorerEnbl = true;
            self.scorer     = customScorerSvc.constructFromData(queryWithRatings.scorer);
          }
        }

        self.ratings = queryWithRatings.ratings;
        if ( self.ratings === undefined ) {
          self.ratings = {};
        }

        self.ratingsStore = ratingsStoreSvc.createRatingsStore(
          caseNo,
          self.queryId,
          self.ratings
        );

        var resultsReturned = false;
        var that = this;

        that.setDirty = function() {
          version++;
          svcVersion++;
        };

        this.persisted = function() {
          return (this.queryId && this.queryId >= 0);
        };

        this.effectiveScorer = function() {
          var scorer = this.scorer;

          if (!scorer) {
          /* use the case default scorer if none
             set for this query */
            return customScorerSvc.defaultScorer;
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
          var allRated = true;
          angular.forEach(otherDocs, function(doc) {
            if (!doc.hasRating()) {
              allRated = false;
            }
          });

          var bestDocs  = this.ratingsStore.bestDocs();
          var scorer    = this.effectiveScorer();

          // The defaults are set below because sometimes quepid saves out scores with no values.
          // TODO: Defaults can be removed if the quepid scoring persistence issue is cleaned up
          var promise   = scorer.score(this, this.numFound, otherDocs, bestDocs, this.options) || 0.0;
          var maxScore  = scorer.maxScore() || 1.0;


          return promise.then(function(score) {
            var color     = qscoreSvc.scoreToColor(score, maxScore);

            return {
              score:            score || 0.0,
              maxScore:         maxScore,
              allRated:         allRated,
              backgroundColor:  color
            };
          });
        };

        this.score = function() {
          if (this.lastScoreVersion === this.version()) {
            var deferred = $q.defer();
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
          var maxDocScore = 0;
          angular.forEach(this.docs, function(doc) {
            maxDocScore = Math.max(doc.score(), maxDocScore);
          });
          return maxDocScore;
        };


        // This method allows scorers to wait on rated documents before trying to score
        this.awaitRatedDocs = function() {
          var deferred = $q.defer();

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
          var settings = angular.copy(currSettings);

          if (pageSize) {
            settings.numberOfRows = pageSize;
          }

          self.ratedSearcher = svc.createSearcherFromSettings(
              settings,
              self.queryText,
              self
            );

          var ratedDocsStaging = [];
          return self.ratedSearcher.search().then(function() {
            self.ratedUrl = self.ratedSearcher.linkUrl;

            var normed = normalizeDocExplains(self, self.ratedSearcher, currSettings.createFieldSpec());

            angular.forEach(normed, function(doc) {
              var rateableDoc = self.ratingsStore.createRateableDoc(doc);
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

          var fieldSpec = currSettings.createFieldSpec();
          var error     = false;
          var docList   = new DocListFactory(
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
          var self = this;

          return $q(function(resolve, reject) {
            self.hasBeenScored = false;

            self.searcher = svc.createSearcherFromSettings(
              currSettings,
              self.queryText
            );

            self.ratedSearcher = svc.createSearcherFromSettings(
              currSettings,
              self.queryText,
              self
            );

            resultsReturned = false;

            var promises = [];

            promises.push(self.searcher.search()
              .then(function() {
                            }, function(response) {
                self.linkUrl = self.searcher.linkUrl;
                self.setDocs([], 0);

                var msg = searchErrorTranslatorSvc.parseResponseObject(response, self.searcher.linkUrl, currSettings.searchEngine);

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
                var error = self.setDocs(self.searcher.docs, self.searcher.numFound);
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

        this.paginate = function() {
          var self = this;

          if (self.searcher === null) {
            return;
          }

          self.searcher = self.searcher.pager();

          return self.searcher.search()
            .then(function() {
              var ratingsStore  = self.ratingsStore;
              var docs          = self.searcher.docs;
              var fieldSpec     = currSettings.createFieldSpec();
              var docList       = new DocListFactory(docs, fieldSpec, ratingsStore);
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
            var self = this;

            if (self.ratedSearcher === null) {
              return;
            }

            self.ratedSearcher = self.ratedSearcher.pager();
            return self.ratedSearcher.search()
              .then(function() {
                var normed = svc.normalizeDocExplains(self, self.ratedSearcher, currSettings.createFieldSpec());
                self.ratedDocs = self.ratedDocs.concat(normed);
              });
        };

        this.saveNotes = function(notes) {
          var that = this;
          var notesJson = { query: { notes: notes } };
          var url = '/api/cases/' + caseNo + '/queries/' + that.queryId + '/notes';

          return $http.put(url , notesJson)
            .then(function() {
              that.notes = notes;
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
          var url   = '/api/cases/' + caseNo + '/queries/' + that.queryId + '/notes';
          return $http.get(url)
            .then(function(response) {
              that.notes = response.data.notes;
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
          var url = '/api/cases/' + caseNo + '/queries/' + that.queryId + '/options';

          return $http.put(url , optionsJson)
            .then(function() {
              that.options = JSON.parse(options);

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
          var url   = '/api/cases/' + caseNo + '/queries/' + that.queryId + '/options';

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

        this.saveScorer = function(scorer) {
          var query = this;
          var url   = '/api/cases/' + caseNo + '/queries/' + this.queryId + '/scorer';
          var data  = {
            scorer_id:   scorer.scorerId
          };

          return $http.put(url, data)
            .then(function() {
              query.scorer      = scorer;
              query.scorerEnbl  = true;
              that.setDirty();
            }, function(response) {
              $log.debug('Failed to save scorer: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to save scorer');
              return response;
            });
        };

        this.unassignScorer = function() {
          var query = this;
          var url   = '/api/cases/' + caseNo + '/queries/' + this.queryId + '/scorer';

          return $http.delete(url)
            .then(function() {
              query.scorer      = null;
              query.scorerEnbl  = false;
              that.setDirty();
            }, function(response) {
              $log.debug('Failed to unassign scorer: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to unassign scorer');
              return response;
            });
        };

        this.setThreshold = function(enabled, threshold) {
          var that          = this;
          var url           = '/api/cases/' + caseNo + '/queries/' + that.queryId + '/threshold';
          var thresholdJson = {
            query: {
              threshold:      threshold,
              threshold_enbl: enabled
            }
          };

          return $http.put(url, thresholdJson)
            .then(function() {
              that.threshold        = threshold;
              that.thresholdEnabled = enabled;
            }, function(response) {
              $log.debug('Failed to set threshold: ', response);
              return response;
            }).catch(function(response) {
              $log.debug('Failed to set threshold');
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

        this.saveTest = function(scorer) {
          var self = this;
          scorer.query_id = self.queryId;

          if ( self.test !== null ) {
            scorer.scorerId = self.test.scorerId;

            return customScorerSvc.edit(scorer)
              .then(function(returnedScorer) {
                self.test = returnedScorer;

                return self.test;
              }, function(response) {
                $log.debug('Failed to save test: ', response);
                return response;
              });
          } else {
            return customScorerSvc.create(scorer)
              .then(function(createdScorer) {
                self.test = createdScorer;

                return self.test;
              }, function(response) {
                $log.debug('Failed to save test: ', response);
                return response;
              });
          }
        };

        this.searchAndScore = function() {
          return this.search().then( () => {
            this.score();
          });
        };

        this.filterToRatings = function(settings, slice) {
          var ratedIDs = self.ratings ? Object.keys(self.ratings) : [];

          // Explain other cannot page thru results, this allows for retrieving slices of the ratings
          if (slice !== undefined) {
            ratedIDs = ratedIDs.slice(slice, settings.numberOfRows + slice);
          }

          var fieldSpec = settings.createFieldSpec();

          if (settings.searchEngine === 'es') {
            var esQuery = {
              'terms': {}
            };
            esQuery['terms'][fieldSpec.id] = ratedIDs;
            return esQuery;
          } else {
            return '{!terms f=' + fieldSpec.id + '}' + ratedIDs.join(',');
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

      var that = this;
      var addQueriesFromResp = function(data) {
        // Update the display order
        svcVersion++;
        that.displayOrder = data.displayOrder;

        // Parse query array
        var newQueries = [];
        angular.forEach(data.queries, function(queryWithRatings) {
          var newQuery = null;
          if (!(queryWithRatings.hasOwnProperty('deleted') &&
                queryWithRatings.deleted === 'true')) {
            var newQueryId = queryWithRatings.queryId;
            if (typeof(queryWithRatings.queryId) === 'string') {
              queryWithRatings.queryId = parseInt(queryWithRatings.queryId, 10);
            }
            newQuery = new Query(queryWithRatings);
            that.queries[newQueryId] = newQuery;
            newQueries.push(newQueryId);
            diffResultsSvc.createQueryDiff(newQuery);
          }
        });

        return newQueries;
      };

      var querySearchableDeferred = $q.defer();
      function bootstrapQueries(caseNo) {
        querySearchableDeferred = $q.defer();
        var path = '/api/cases/' + caseNo + '/queries?bootstrap=true';

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
          customScorerSvc.bootstrap(newCaseNo);
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


      this.searchAll = function() {
        var promises = [];
        var scorePromises = [];

        angular.forEach(this.queries, function(query) {
          var promise = query.search().then( () => {
            scorePromises.push(query.score());
          });

          promises.push(promise);
        });

        // Holy nested promises batman
        return $q.all(promises).then( () => {
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
            svc.scoreAll().then( () => {
              $scope.$emit('scoring-complete');
            });
          });
        });
      };

      // the try that the query results reflect
      this.displayedTryNo = function() {
        return currSettings.selectedTry.tryNo;
      };

      this.createQuery = function(queryText) {
        var queryJson = {
          'query_text': queryText,
          deleted:      false,
          queryId:      -1
        };
        var newQuery = new Query(queryJson);
        diffResultsSvc.createQueryDiff(newQuery);
        return newQuery;
      };

      this.persistQuery = function(query) {
        var self = this;

        return $q(function(resolve, reject) {
          if (query.persisted()) {
            resolve();
            return;
          }

          var path = '/api/cases/' + caseNo + '/queries';
          var postData = {
            query: {
              query_text: query.queryText
            }
          };

          $http.post(path, postData)
            .then(function(response) {
              var data = response.data;
              if ( response.status === 204 ) {
                // This typically happens when the query already exists, so
                // no change happened
                resolve();
              } else {
                // Update the display order based on the new one after the query creation
                self.displayOrder = data.displayOrder;

                var addedQuery = data.query;

                query.queryId = parseInt(addedQuery.queryId, 10);
                query.ratingsStore.setQueryId(addedQuery.queryId);
                self.queries[query.queryId] = query;
                svcVersion++;
                broadcastSvc.send('updatedQueriesList');

                resolve();
              }
            }, function(response) {
              var data = response.data;
              reject(data);
            }).catch(function(response) {
              $log.debug('Failed to persist query');
              return response;
            });
        });
      };

      this.persistQueries = function(queries) {
        var deferred = $q.defer();

        var queryTexts = [];
        angular.forEach(queries, function(query) {
          if ( !query.persisted() ) {
            queryTexts.push(query.queryText);
          }
        });

        if ( queryTexts.length === 0 ) {
          deferred.resolve();
          return deferred.promise;
        }

        var path = '/api/bulk/cases/' + caseNo + '/queries';
        var data = {
          queries: queryTexts
        };

        var that = this;
        $http.post(path, data)
          .then(function(response) {
            var data = response.data;
            if ( response.status === 204 ) {
              // This typically happens when the query already exists, so
              // no change happened
              deferred.resolve();
            } else {
              // Update the display order based on the new one after the query creation
              that.queries = {};
              addQueriesFromResp(data);
              deferred.resolve();
            }
          }, function(response) {
            var data = response.data;
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
        var rVal = [];

        for (var displayIter = 0; displayIter < this.displayOrder.length; ++displayIter) {
          var currQueryId = this.displayOrder[displayIter];
          if (this.queries.hasOwnProperty(currQueryId)) {
            this.queries[currQueryId].defaultCaseOrder = displayIter;
            rVal.push(this.queries[currQueryId]);
          }
        }
        return rVal;
      };

      this.updateQueryDisplayPosition = function(queryId, oldQueryId, reverse) {
        var url     = '/api/cases/' + caseNo + '/queries/' + queryId + '/position';
        var data    = {
          after:    oldQueryId,
          reverse:  reverse
        };

        return $http.put(url, data)
          .then(function(response) {
            svc.displayOrder = response.data.displayOrder;
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
        var path = '/api/cases/' + caseNo + '/queries/' + queryId;
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
        var path = '/api/cases/' + query.caseNo + '/queries/' + query.queryId;
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
       * This method prepares the scores table that the qgraph/qscore needs.
       *
       */
      this.scoreAll = function(scorables) {
        var avg = 0;
        var tot = 0;
        var allRated = true;
        if (scorables === undefined) {
          scorables = this.queries;
        }

        var queryScores =  {};

        var promises = [];
        angular.forEach(scorables, function(scorable) {
          promises.push(scorable.score().then(function(scoreInfo) {
            if (!scoreInfo.allRated) {
              allRated = false;
            }

            if (scoreInfo.score !== null) {
              avg += scoreInfo.score;
              tot++;
              queryScores[scorable.queryId] = {
                score:    scoreInfo.score,
                maxScore: scoreInfo.maxScore,
                text:     scorable.queryText,
                numFound: scorable.numFound,
              };
            } else {
              queryScores[scorable.queryId] = {
                score:    '',
                maxScore: scoreInfo.maxScore,
                text:     scorable.queryText,
                numFound: scorable.numFound,
              };
            }

            return scoreInfo;
          }));
        });

        return $q.all(promises).then(function() {
          if (tot > 0) {
            avg = avg/tot;
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

      this.setDiffSetting = function(diffSetting) {
        diffResultsSvc.setDiffSetting(diffSetting);
        angular.forEach(this.queries, function(query) {
          diffResultsSvc.createQueryDiff(query);
        });
      };

      this.scoreAllDiffs = function() {
        var diffs = [];
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

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }
    }
  ]);
