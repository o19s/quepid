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
      
      // This function is meant to be used in a mapper, and is duplicated
      // in wizardModal.js too ;-()
      /* jshint ignore:start */
      function sha256(ascii) {
          function rightRotate(value, amount) {
              return (value>>>amount) | (value<<(32 - amount));
          };
          
          var mathPow = Math.pow;
          var maxWord = mathPow(2, 32);
          var lengthProperty = 'length'
          var i, j; // Used as a counter across the whole file
          var result = ''
      
          var words = [];
          var asciiBitLength = ascii[lengthProperty]*8;
          
          //* caching results is optional - remove/add slash from front of this line to toggle
          // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
          // (we actually calculate the first 64, but extra values are just ignored)
          var hash = sha256.h = sha256.h || [];
          // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
          var k = sha256.k = sha256.k || [];
          var primeCounter = k[lengthProperty];
          /*/
          var hash = [], k = [];
          var primeCounter = 0;
          //*/
      
          var isComposite = {};
          for (var candidate = 2; primeCounter < 64; candidate++) {
              if (!isComposite[candidate]) {
                  for (i = 0; i < 313; i += candidate) {
                      isComposite[i] = candidate;
                  }
                  hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
                  k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
              }
          }
          
          ascii += '\x80' // Append Ƈ' bit (plus zero padding)
          while (ascii[lengthProperty]%64 - 56) ascii += '\x00' // More zero padding
          for (i = 0; i < ascii[lengthProperty]; i++) {
              j = ascii.charCodeAt(i);
              if (j>>8) return; // ASCII check: only accept characters in range 0-255
              words[i>>2] |= j << ((3 - i)%4)*8;
          }
          words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
          words[words[lengthProperty]] = (asciiBitLength)
          
          // process each chunk
          for (j = 0; j < words[lengthProperty];) {
              var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
              var oldHash = hash;
              // This is now the undefinedworking hash", often labelled as variables a...g
              // (we have to truncate as well, otherwise extra entries at the end accumulate
              hash = hash.slice(0, 8);
              
              for (i = 0; i < 64; i++) {
                  var i2 = i + j;
                  // Expand the message into 64 words
                  // Used below if 
                  var w15 = w[i - 15], w2 = w[i - 2];
      
                  // Iterate
                  var a = hash[0], e = hash[4];
                  var temp1 = hash[7]
                      + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
                      + ((e&hash[5])^((~e)&hash[6])) // ch
                      + k[i]
                      // Expand the message schedule if needed
                      + (w[i] = (i < 16) ? w[i] : (
                              w[i - 16]
                              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3)) // s0
                              + w[i - 7]
                              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10)) // s1
                          )|0
                      );
                  // This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
                  var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
                      + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2])); // maj
                  
                  hash = [(temp1 + temp2)|0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
                  hash[4] = (hash[4] + temp1)|0;
              }
              
              for (i = 0; i < 8; i++) {
                  hash[i] = (hash[i] + oldHash[i])|0;
              }
          }
          
          for (i = 0; i < 8; i++) {
              for (j = 3; j + 1; j--) {
                  var b = (hash[i]>>(j*8))&255;
                  result += ((b < 16) ? 0 : '') + b.toString(16);
              }
          }
          return result;
      };
      /* jshint ignore:end */

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


        // Threshold properties
        self.threshold        = queryWithRatings.threshold;
        self.thresholdEnabled = queryWithRatings.threshold_enabled;

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

        this.setThreshold = function(enabled, threshold) {
          var that          = this;
          var url           = 'api/cases/' + caseNo + '/queries/' + that.queryId + '/threshold';
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

        this.searchAndScore = function() {
          return this.search().then( () => {
            this.score();
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


      this.searchAll = function() {
        let promises = [];
        let scorePromises = [];

        angular.forEach(this.queries, function(query) {
          let promise = query.search().then( () => {
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
            svc.scoreAll();
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
                broadcastSvc.send('updatedQueriesList');

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
       * This method prepares the scores table that the qgraph/qscore needs.
       *
       */
      this.scoreAll = function(scorables) {
        let avg = 0;
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

            if (scoreInfo.score !== null) {
              // Treat non-rated queries as zeroes when calculating case score
              avg += scoreInfo.score === '--' ? 0 : scoreInfo.score;
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

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }
    }
  ]);
