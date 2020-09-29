'use strict';

/*jslint latedef:false*/

// Responsible for managing individual queries
// so its a starting point for a lot of functionality...
// .... (as you can tell by the dependencies)
angular.module('QuepidApp')
  .service('queriesSvc', [
    '$http',
    '$timeout',
    '$q',
    '$log',
    '$rootScope',
    '$location',
    'broadcastSvc',
    'caseSvc',
    'customScorerSvc',
    'qscoreSvc',
    'searchSvc',
    'solrUrlSvc',
    'ratingsStoreSvc',
    'DocListFactory',
    'diffResultsSvc',
    'searchErrorTranslatorSvc',
    function queriesSvc(
      $http,
      $timeout,
      $q,
      $log,
      $rootScope,
      $location,
      broadcastSvc,
      caseSvc,
      customScorerSvc,
      qscoreSvc,
      searchSvc,
      solrUrlSvc,
      ratingsStoreSvc,
      DocListFactory,
      diffResultsSvc,
      searchErrorTranslatorSvc
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
        svc.svcVersion++;
      }

      $rootScope.showOnlyRated = $location.search().showOnlyRated;
      console.log('Initial showOnlyRated toggle is ' + $rootScope.showOnlyRated);

      this.getCaseNo = getCaseNo;
      this.createSearcherFromSettings = createSearcherFromSettings;

      svc.bootstrapQueries = bootstrapQueries;

      function createSearcherFromSettings(passedInSettings, query, filterIds) {
        var args = angular.copy(passedInSettings.selectedTry.args);
        // TODO: This is Solr specific
        console.log('showOnlyRated in createSearcherFromSettings() is ' + $rootScope.showOnlyRated);
        if ($rootScope.showOnlyRated === 'true' && filterIds.length > 0) {
          args['fq'] = '{!terms f=' + passedInSettings.createFieldSpec().id + '}' + filterIds.join(',');
          console.log('showOnlyRated true, adding query filter for Solr');
        }

        if (passedInSettings && passedInSettings.selectedTry) {
          return searchSvc.createSearcher(
            passedInSettings.createFieldSpec().fieldList(),
            passedInSettings.selectedTry.searchUrl,
            args,
            query,
            {
              escapeQuery:   passedInSettings.escapeQuery,
              numberOfRows:  passedInSettings.numberOfRows,
            },
            passedInSettings.searchEngine
          );
        }
      }

      this.unscoredQueries = {};

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

        self.queryId        = queryWithRatings.queryId;
        self.caseNo         = caseNo;
        self.queryText      = queryWithRatings[qt];
        self.scorerId       = null;
        self.scorerEnbl     = false;
        self.scorer         = null;
        self.docs           = [];
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

        var ratings = queryWithRatings.ratings;
        if ( ratings === undefined ) {
          ratings = {};
        }

        self.ratingsStore = ratingsStoreSvc.createRatingsStore(
          caseNo,
          self.queryId,
          ratings
        );
        self.ratings        = ratings;

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
        var lastScoreVersion = -5;

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
          var score     = scorer.score(this.numFound, otherDocs, bestDocs, this.options) || 0.0;
          var maxScore  = scorer.maxScore(this.numFound, otherDocs, bestDocs, this.options) || 1.0;

          var color     = qscoreSvc.scoreToColor(score, maxScore);

          var othersScore = {
            score:            score,
            maxScore:         maxScore,
            allRated:         allRated,
            backgroundColor:  color
          };
          return othersScore;
        };

        this.score = function() {
          if (lastScoreVersion === this.version()) {
            return this.currentScore;
          }

          this.currentScore = this.scoreOthers(this.docs);

          this.lastScore    = this.currentScore.score || 0;
          this.allRated     = this.currentScore.allRated;

          // if we have received docs, mark this query as successfully scored
          if (this.docsSet) {
            this.markScored();
          }

          lastScoreVersion = this.version();

          return this.currentScore;
        };

        this.markScored = function() {
          this.hasBeenScored = true;
          delete svc.unscoredQueries[this.queryId];
        };

        this.markUnscored = function() {
          this.hasBeenScored = false;
          svc.unscoredQueries[this.queryId] = true;
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
          that.score();

          return error;
        };

        this.onError = function(errorText) {
          that.errorText = errorText;
        };

        this.browseUrl = function() {
          return that.linkUrl;
        };

        this.version = function() {
          return version + this.ratingsStore.version();
        };

        this.search = function() {
          var self = this;

          return $q(function(resolve, reject) {
            self.markUnscored();

            var ratedIds = Object.keys(self.ratings);
            self.searcher = svc.createSearcherFromSettings(
              currSettings,
              self.queryText,
              ratedIds
            );
            console.log('Ratings: ' + JSON.stringify(ratedIds, undefined, 2));
            resultsReturned = false;

            self.searcher.search()
              .then(function() {
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
                  }
                  self.othersExplained = self.searcher.othersExplained;
                }

                resolve();
              }, function(response) {
                self.linkUrl = self.searcher.linkUrl;
                self.setDocs([], 0);

                var msg = searchErrorTranslatorSvc.parseResponseObject(response, self.searcher.linkUrl, currSettings.searchEngine);

                self.onError(msg);
                reject(msg);
              }).catch(function(response) {
                $log.debug('Failed to load search results');
                return response;
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
      };

      this.QueryFactory = Query;

      this.hasUnscoredQueries = function() {
        return this.unscoredQueryCount() > 0;
      };

      this.unscoredQueryCount = function() {
        return Object.keys(this.unscoredQueries).length;
      };

      this.scoredQueryCount = function() {
        return this.queryCount() - this.unscoredQueryCount();
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

        angular.forEach(this.queries, function(query) {
          promises.push(query.search());
        });

        return $q.all(promises);
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
                query.markUnscored();
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

      this.scoreAll = function(scorables) {
        var avg = 0;
        var tot = 0;
        var allRated = true;
        if (scorables === undefined) {
          scorables = this.queries;
        }

        var queryScores =  {};

        angular.forEach(scorables, function(scorable) {
          var scoreInfo = scorable.score();

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
        });

        if (tot > 0) {
          avg = avg/tot;
        }

        return {
          'allRated': allRated,
          'score':    avg,
          'queries':  queryScores,
        };
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

        this.scoreAll();
        svcVersion++;
      };

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }
    }
  ]);
