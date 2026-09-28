'use strict';

/* jslint latedef:false */

/**
 * Central service for query lifecycle: in-memory `Query` objects, search against the current try
 * (or snapshots), scoring, diffs, ratings, book sync, and bulk operations (`searchAll`, persist, reorder).
 * Most of the interactive case page depends on this service and `settingsSvc`.
 */
angular.module('QuepidApp')
  .service('queriesSvc', [
    '$rootScope',
    '$http',
    '$q',
    '$log',
    'scorerSvc',
    'searchSvc',
    'caseTryNavSvc',
    'DocListFactory',
    'esExplainExtractorSvc',
    'solrExplainExtractorSvc',
    'normalDocsSvc',
    'settingsSvc',
    'searchEndpointSvc',
    function queriesSvc(
      $scope,
      $http,
      $q,
      $log,
      scorerSvc,
      searchSvc,
      caseTryNavSvc,
      DocListFactory,
      esExplainExtractorSvc,
      solrExplainExtractorSvc,
      normalDocsSvc,
      settingsSvc,
      searchEndpointSvc
    ) {

      let caseNo = -1;
      let currSettings = {};
      this.error = false;
      let svcVersion = 0;
      let ratingsVersion = 0;

      // Keyed by the mapper_code string itself, so a re-eval is only ever skipped for the
      // exact same code (editing a mapper - or switching to a different mapper-based try -
      // naturally busts the cache via a different key). See evaluateMapperFunctions() below.
      let mapperFunctionsCache = {};

      let svc = this;
      // Temporary dual-run bridge: the store owns the query collection snapshot
      // and display order while Angular keeps the live Query objects for search,
      // ratings, documents, and scoring.
      let queryCollectionStore = window.quepidStore && window.quepidStore.queries;
      let queryDocumentsStore = window.quepidStore && window.quepidStore.documents;
      let diffStateStore = window.quepidStore && window.quepidStore.diff;
      this.displayOrder = [];
      this.queries = {};
      this.linkUrl = '';

      function getAllDiffSettings() {
        return diffStateStore ? diffStateStore.selections() : [];
      }

      let bookSyncRuntime = window.quepidSearch.bookSync.createRuntime({
        logger: $log
      });

      let liveQueryAdapters = window.quepidSearch.liveQueryAdapters.create({
        compatibility: {
          factoryOptions: {
            model: {
              getDefaultScorer: function() {
                return liveQueryAdapters.scoring.getDefault();
              },
              scoreQuery: window.quepidSearch.queryScoring.scoreQuery,
              promiseApi: $q,
              getFieldSpec: function() {
                return currSettings.createFieldSpec();
              },
              buildRatingsFilter: window.quepidSearch.ratedDocs.buildFilter,
              ratedDocIds: window.quepidSearch.ratedDocs.ids,
              onDirty: function() {
                svcVersion++;
              }
            },
            documents: {
              getFieldSpec: function() {
                return currSettings.createFieldSpec();
              },
              createDocList: function(docs, fieldSpec, ratingsStore, explain) {
                return new DocListFactory(docs, fieldSpec, ratingsStore, explain);
              },
              matchFeaturesExplain: matchFeaturesExplain
            },
            factory: {
              getCaseNo: getCaseNo,
              getShowOnlyRated: function() {
                return svc.showOnlyRated;
              },
              RatingsStore: window.quepidSearch.ratings.RatingsStore,
              request: function(options) {
                return $http(options);
              },
              onRatingChanged: function(changedQueryId) {
                ratingsVersion++;

                if (window.quepidStore && window.quepidStore.scoring) {
                  window.quepidStore.scoring.markRatingChanged(changedQueryId);
                } else {
                  document.dispatchEvent(new CustomEvent('ratings:changed', {
                    detail: { queryId: changedQueryId }
                  }));
                }
              },
              getQueryState: function(query) {
                return window.quepidSearch.queryState.queryLifecycleState({
                  errorText: query.errorText,
                  resultsReturned: query.resultsReturned,
                  docCount: query.docs.length
                });
              }
            },
            publish: publishQueryDocuments
          },
          executionOptions: {
            settings: {
              get: function() {
                return currSettings;
              },
              copy: function(settings) {
                return angular.copy(settings);
              }
            },
            searchers: {
              create: function(query, options) {
                return createSearcherFromSettings(currSettings, query, options);
              },
              createRated: function(settings, query) {
                return createSearcherFromSettings(settings, query, { filterToRated: true });
              },
              searchApiRatedDocs: function(settings, query, ratedIDs) {
                return searchApiRatedDocs(settings, query, ratedIDs);
              },
              supportsRated: function(aTry) {
                return trySupportsSearchApiRatedDocsLookup(aTry);
              },
              createSnapshot: function(snapshotId, query) {
                return createSearcherFromSnapshot(snapshotId, query, currSettings);
              }
            },
            documents: {
              normalize: function(query, searcher, fieldSpec) {
                return normalizeDocExplains(query, searcher, fieldSpec);
              },
              createRateable: function(query, doc) {
                return query.ratingsStore.createRateableDoc(doc);
              }
            },
            errors: {
              parse: function(response, linkUrl) {
                return window.quepidSearch.searchErrors.parseResponseObject(response, linkUrl, currSettings.searchEngine);
              }
            },
            publish: publishQueryDocuments,
            promiseApi: $q,
            logger: $log
          }
        },
        scoring: {
          getDefault: function() {
            return scorerSvc.defaultScorer;
          },
          select: function(scorerData) {
            var scorer = scorerSvc.constructFromData(scorerData);
            return scorerSvc.setDefault(scorer);
          },
          bootstrap: function(newCaseNo) {
            return scorerSvc.bootstrap(newCaseNo);
          }
        },
        book: {
          configure: function(nextCaseNo, response) {
            bookSyncRuntime.configure({
              caseId: nextCaseNo,
              bookId: response.data.book_id,
              autoPopulate: response.data.auto_populate_book_pairs
            });
          },
          reset: function() {
            bookSyncRuntime.reset();
          },
          sync: function(queries) {
            return bookSyncRuntime.sync(queries);
          }
        }
      });

      document.addEventListener('case-book:associated', function() {
        // Re-fetch case data to update cached sync properties
        if (caseNo && caseNo !== -1) {
          $http.get('api/cases/' + caseNo).then(function(response) {
            liveQueryAdapters.book.configure(caseNo, response);
          });
        }
      });

      function reset() {
        svc.queries = {};
        svc.showOnlyRated = false;
        svc.isBootstrapping = false;
        svc.svcVersion++;
        if (queryCollectionStore) {
          queryCollectionStore.reset();
        }
        if (queryDocumentsStore) {
          queryDocumentsStore.reset();
        }
        liveQueryAdapters.book.reset();
        publishQueryListState();
      }

      // Explicit adapter for the Stimulus query list. Angular retains the live
      // Query objects, but the list no longer discovers them through an
      // Angular controller scope.
      function publishQueryListState() {
        document.dispatchEvent(new CustomEvent('queries-state:changed'));
      }

      // Case-level scoring orchestration lives in the framework-free query
      // runtime. Angular remains the compatibility adapter for the live Query
      // objects and the legacy latestScoreInfo shape during dual-run.
      let caseScoringRuntime = window.quepidSearch.queryScoring.createCaseScoringRuntime({
        getScorables: function() {
          return svc.queries;
        },
        promiseApi: $q,
        logger: console,
        onComplete: function(scoreInfo, metadata) {
          svc.latestScoreInfo = scoreInfo;

          // The score store replaces its complete query-score map. Partial
          // scoring (for example diff-only scoring) must not erase live
          // query badges from the store.
          if (metadata.isFullScoreAll) {
            window.quepidStore.scoring.setLatestScoreInfo(scoreInfo);
          }

          publishQueryListState();
        }
      });

      let liveQueryCollectionRuntime = window.quepidSearch.queryLifecycle.createCollectionRuntime({
        request: function(caseId) {
          return $http(window.quepidSearch.queryLifecycle.bootstrapRequest(caseId));
        },
        createQuery: function(queryData) {
          return liveQueryFactory.create(queryData);
        },
        createDiff: function(query) {
          window.quepidSearch.diff.createQueryDiff({
            query: query,
            diffSettings: getAllDiffSettings(),
            settings: settingsSvc.editableSettings(),
            createSearcherFromSnapshot: createSearcherFromSnapshot
          });
        },
        clearQueries: function() {
          svc.queries = {};
        },
        registerQuery: function(queryId, query) {
          svc.queries[queryId] = query;
        },
        applyDisplayOrder: function(displayOrder) {
          applyDisplayOrder(displayOrder);
        },
        replaceStore: function(collectionCaseId, data) {
          if (queryCollectionStore) queryCollectionStore.replaceFromResponse(collectionCaseId, data);
        },
        beginStoreBootstrap: function(caseId) {
          if (queryCollectionStore) queryCollectionStore.beginBootstrap(caseId);
        },
        markStoreError: function(response) {
          if (queryCollectionStore) queryCollectionStore.markError(response);
        },
        setBootstrapping: function(value) {
          svc.isBootstrapping = value;
        },
        publishState: publishQueryListState,
        onVersion: function() {
          svcVersion++;
        },
        defer: function() {
          return $q.defer();
        },
        logger: $log
      });

      let liveQueryCompatibilityRuntime = window.quepidSearch.queryLifecycle.createCompatibilityRuntime({
        model: window.quepidSearch.liveQueryModel,
        factory: window.quepidSearch.liveQueryFactory,
        documents: window.quepidSearch.liveQueryDocuments,
        execution: window.quepidSearch.liveQueryExecution,
        factoryOptions: liveQueryAdapters.compatibility.factoryOptions,
        executionOptions: liveQueryAdapters.compatibility.executionOptions
      });
      let liveQueryDocumentsRuntime = liveQueryCompatibilityRuntime.documents;
      let liveQueryRuntime = liveQueryCompatibilityRuntime.execution;
      let liveQueryFactory = liveQueryCompatibilityRuntime.factory;

      let liveQueryTransportRuntime = window.quepidSearch.queryLifecycle.createTransportRuntime({
        queryRuntime: liveQueryRuntime,
        getQueries: function() {
          return svc.queries;
        },
        getRequestsPerMinute: function() {
          return currSettings.selectedTry.requestsPerMinute;
        },
        resetQuery: function(query) {
          liveQueryDocumentsRuntime.reset(query);
          liveQueryDocumentsRuntime.publish(query);
        },
        scoreAll: function() {
          return window.quepidSearch.queryCapabilities.scoreAll();
        },
        syncToBook: function() {
          return liveQueryAdapters.book.sync(queryArray());
        },
        onSearchStarted: function() {
          return queryCollectionStore ? queryCollectionStore.beginSearch() : null;
        },
        onSearchCompleted: function(generation) {
          if (queryCollectionStore) queryCollectionStore.finishSearch(generation);
        },
        onSearchFailed: function(error, generation) {
          if (queryCollectionStore) queryCollectionStore.failSearch(error, generation);
        },
        promiseApi: $q,
        logger: $log
      });

      let liveQueryCommandsRuntime = window.quepidSearch.liveQueryCommands.create({
        getQuery: getLiveQuery,
        getShowOnlyRated: function() {
          return svc.showOnlyRated;
        },
        queryRuntime: liveQueryRuntime,
        documentRuntime: liveQueryDocumentsRuntime,
        schedule: function(callback) {
          $scope.$evalAsync(callback);
        },
        reject: function(message) {
          return $q.reject(message);
        }
      });

      let liveQueryEventsRuntime = window.quepidSearch.liveQueryEvents.create({
        scoringStore: window.quepidStore && window.quepidStore.scoring,
        getCaseNo: getCaseNo,
        getQuery: getLiveQuery,
        getQueries: function() {
          return svc.queries;
        },
        invalidateRatedDocs: function(query) {
          window.quepidSearch.queryState.invalidateRatedDocsCache(query);
        },
        publishQuery: publishQueryDocuments,
        scoreAll: function() {
          return window.quepidSearch.queryCapabilities.scoreAll();
        },
        updateScores: function() {
          return window.quepidSearch.queryCapabilities.updateScores();
        },
        setQueryOptions: function(query, options) {
          query.options = options;
          query.setDirty();
        },
        setScorer: function(scorerData) {
          return liveQueryAdapters.scoring.select(scorerData);
        },
        reloadQueries: function(caseId) {
          window.quepidSearch.queryCapabilities.resetQueryState();
          return window.quepidSearch.queryCapabilities.bootstrapQueries(caseId).then(function() {
            return window.quepidSearch.queryCommands.searchAll();
          });
        },
        schedule: function(callback) {
          $scope.$evalAsync(callback);
        },
        scheduleApply: function(callback) {
          $scope.$applyAsync(callback);
        }
      });
      liveQueryEventsRuntime.connect();

      let liveQueryLifecycleRuntime = window.quepidSearch.queryLifecycle.createRuntime({
        createQuery: function(queryText) {
          return createQuery(queryText);
        },
        reset: function() {
          reset();
        },
        bootstrapQueries: function(caseId) {
          return liveQueryCollectionRuntime.bootstrapQueries(caseId);
        },
        searchAll: function() {
          return searchAll();
        },
        clearQueries: function() {
          svc.queries = {};
        },
        addQueriesFromResponse: function(data, caseId) {
          liveQueryCollectionRuntime.addQueriesFromResponse(data, caseId);
        },
        getCaseNo: getCaseNo,
        applyDisplayOrder: function(displayOrder) {
          applyDisplayOrder(displayOrder);
        },
        setQueryId: function(query, queryId) {
          query.ratingsStore.setQueryId(queryId);
        },
        registerQuery: function(queryId, query) {
          svc.queries[queryId] = query;
          if (queryCollectionStore) queryCollectionStore.upsert(query);
        },
        onVersion: function() {
          svcVersion++;
        },
        removeQuery: function(queryId) {
          var key = String(queryId);
          if (!svc.queries[key] && !svc.queries[queryId]) return false;
          delete svc.queries[key];
          if (key !== String(queryId)) delete svc.queries[queryId];
          return true;
        },
        searchAndScore: function(query) {
          return searchAndScore(query);
        },
        updateScores: function() {
          window.quepidSearch.queryCapabilities.updateScores();
        },
        logger: $log
      });

      let liveQueryDiffRuntime = window.quepidSearch.liveQueryDiff.create({
        getQueries: function() {
          return svc.queries;
        },
        getDiffSettings: getAllDiffSettings,
        getSettings: function() {
          return settingsSvc.editableSettings();
        },
        createSearcherFromSnapshot: createSearcherFromSnapshot,
        publish: publishQueryDocuments,
        notify: function(detail) {
          document.dispatchEvent(new CustomEvent('query-diffs:refreshed', {
            detail: detail
          }));
        },
        promiseApi: $q
      });

      let liveQueryStateRuntime = window.quepidSearch.liveQueryState.create({
        getQueries: function() {
          return svc.queries;
        },
        scoreAll: function(scorables) {
          return scorables === undefined
            ? window.quepidSearch.queryCapabilities.scoreAll()
            : window.quepidSearch.queryCapabilities.scoreAll(scorables);
        },
        applySettings: function(newSettings) {
          currSettings = newSettings;
        },
        setLifecycleCaseId: function(newCaseNo) {
          window.quepidSearch.queryLifecycle.caseId = newCaseNo;
        },
        getCurrentCaseNo: getCaseNo,
        setCurrentCaseNo: function(newCaseNo) {
          caseNo = newCaseNo;
        },
        bootstrapScorer: function(newCaseNo) {
          liveQueryAdapters.scoring.bootstrap(newCaseNo);
        },
        bootstrapQueries: function(newCaseNo) {
          liveQueryCollectionRuntime.bootstrapQueries(newCaseNo);
        },
        configureBook: function(newCaseNo) {
          $http.get('api/cases/' + newCaseNo).then(function(response) {
            liveQueryAdapters.book.configure(newCaseNo, response);
          });
        },
        refreshQueryDiff: function(query) {
          query.diff.fetch();
        },
        queryReady: {
          resolve: function() {
            liveQueryCollectionRuntime.resolveSearchPromise();
          },
          promise: function() {
            return liveQueryCollectionRuntime.searchablePromise();
          }
        },
        onVersion: function() {
          svcVersion++;
        },
        promiseApi: $q
      });

      window.quepidSearch.queryCapabilities.getListState = function() {
        var selectedTry = settingsSvc.applicableSettings() || {};
        return {
          canAddQueries: selectedTry.searchEngine !== 'static',
          addQueryMessage: selectedTry.searchEngine === 'static' ? 'Adding queries is not supported' : 'Add a query to this case',
          showOnlyRated: svc.showOnlyRated === true,
          // Match the query-list controller's showOnlyRatedUnsupported state: while the case is
          // still loading, no selected try means the capability is unknown,
          // not unsupported.
          showOnlyRatedUnsupported: settingsSvc.isTrySelected() ? !trySupportsRatedDocsLookup(selectedTry) : false,
          isBootstrapping: svc.isBootstrapping === true,
          searching: hasUnscoredQueries(),
          batchPosition: scoredQueryCount(),
          batchSize: queryCount()
        };
      };
      window.quepidSearch.queryCommands.toggleShowOnlyRated = toggleShowOnlyRated;
      window.quepidSearch.queryCapabilities.isSortingEnabled = function() {
        return false;
      };
      window.quepidSearch.queryCommands.collapseAll = function() {
        if (queryDocumentsStore) queryDocumentsStore.collapseAll();
      };
      window.quepidSearch.queryCapabilities.setDisplayOrder = function(displayOrder) {
        applyDisplayOrder(displayOrder);
      };
      window.quepidSearch.queryCapabilities.changeSettings = function(newCaseNo, newSettings) {
        return liveQueryStateRuntime.changeSettings(newCaseNo, newSettings);
      };
      // Keep case transitions behind an explicit capability. Modern bootstrap
      // code must not reach into the Angular service or its live collection.
      window.quepidSearch.queryCapabilities.resetQueryState = function() {
        reset();
      };
      window.quepidSearch.queryCapabilities.bootstrapQueries = bootstrapQueries;
      window.quepidSearch.queryCapabilities.resetSearchPromise = function() {
        liveQueryCollectionRuntime.resetSearchPromise();
      };
      window.quepidSearch.queryCapabilities.getQueryArray = queryArray;
      window.quepidSearch.queryCapabilities.getVersion = function() {
        return svcVersion + ratingsVersion;
      };

      // Temporary adapter for the Stimulus query-lifecycle controller. The
      // framework-free runtime owns persistence orchestration while this
      // service supplies the live Angular Query state callbacks.
      window.quepidSearch.queryLifecycle.prepareQueries = liveQueryLifecycleRuntime.prepareQueries;
      window.quepidSearch.queryLifecycle.commitQueries = liveQueryLifecycleRuntime.commitQueries.bind(liveQueryLifecycleRuntime);
      window.quepidSearch.queryLifecycle.commitPersistedQueries = liveQueryLifecycleRuntime.commitPersistedQueries;
      window.quepidSearch.queryLifecycle.refreshQueries = liveQueryLifecycleRuntime.refreshQueries;

      // Rated-docs lookup rules live in app/javascript/utils/rated_docs.js (Vitest-covered);
      // these stay as the Angular-facing names that deferred result controls and docFinder.js call.
      function trySupportsSearchApiRatedDocsLookup(aTry) {
        return window.quepidSearch.ratedDocs.supportsSearchApiLookup(aTry);
      }

      function trySupportsRatedDocsLookup(aTry) {
        return window.quepidSearch.ratedDocs.supportsLookup(aTry);
      }

      // Temporary dual-run publisher: Angular keeps the live Query objects, but
      // Stimulus receives a plain read model for expanded result rendering.
      function publishQueryDocuments(query) {
        if (!queryDocumentsStore || !query) {
          return;
        }

        var effectiveScorer = angular.isFunction(query.effectiveScorer) ? query.effectiveScorer() : null;
        var ratingScale = query.ratings && query.ratings.scale;
        if (!ratingScale && effectiveScorer && angular.isFunction(effectiveScorer.getColors)) {
          ratingScale = effectiveScorer.getColors();
        }
        var applicableSettings = settingsSvc.applicableSettings() || {};
        var readModel = window.quepidSearch.queryDocuments.buildState({
          query: query,
          settings: applicableSettings,
          selectedTry: applicableSettings.selectedTry || {},
          ratingScale: ratingScale || {},
          diffs: buildDiffReadModel(query),
          documentUrlFor: function(doc) {
            if (!doc || !angular.isFunction(doc._url)) return null;

            var linkUrl;
            try {
              linkUrl = doc._url();
            } catch {
              return null;
            }
            if (applicableSettings.basicAuthCredential) {
              linkUrl = linkUrl.replace('://', '://' + applicableSettings.basicAuthCredential + '@');
            }
            if (applicableSettings.proxyRequests === true) {
              linkUrl = caseTryNavSvc.getQuepidProxyUrl(applicableSettings.searchEndpointId) + linkUrl;
            }
            return linkUrl;
          }
        });
        queryDocumentsStore.replaceQuery(query.queryId, readModel);
        if (queryCollectionStore) {
          queryCollectionStore.upsert(query);
        }
      }

      function buildDiffReadModel(query) {
        if (!query || !query.diffs || !angular.isFunction(query.diffs.getSearchers)) {
          return null;
        }

        var showOnlyRated = svc.showOnlyRated === true;
        return {
          searchers: query.diffs.getSearchers().map(function(searcher, index) {
            var score = searcher.diffScore || { score: '?', allRated: false };
            var docs = query.diffs.docs(index, false) || [];
            var ratedDocs = query.diffs.docs(index, true) || [];
            var maxDocScore = docs.reduce(function(max, doc) {
              return Math.max(max, angular.isFunction(doc.score) ? doc.score() : 0);
            }, 0);

            return {
              name: angular.isFunction(searcher.name) ? searcher.name() : 'Snapshot',
              version: angular.isFunction(searcher.version) ? searcher.version() : null,
              inError: searcher.inError,
              searchError: searcher.searchError,
              score: score,
              maxDocScore: maxDocScore,
              docs: showOnlyRated ? [] : docs,
              ratedDocs: ratedDocs
            };
          })
        };
      }

      // Explicit command adapter for the Stimulus results renderer. The live
      // Query objects remain here until search and scoring migrate, but the
      // renderer does not need to discover them through an Angular scope.
      function getLiveQuery(queryId) {
        return svc.queries[queryId] || svc.queries[String(queryId)] || null;
      }

      window.quepidSearch.queryCapabilities.getQuery = getLiveQuery;
      window.quepidSearch.queryCapabilities.getQueries = function() {
        return svc.queries;
      };
      window.quepidSearch.queryCapabilities.getCaseNo = getCaseNo;
      window.quepidSearch.queryCapabilities.resetQuery = function(queryId) {
        var query = getLiveQuery(queryId);
        if (!query) return false;
        liveQueryDocumentsRuntime.reset(query);
        publishQueryDocuments(query);
        return true;
      };
      window.quepidSearch.queryCapabilities.searchQuery = function(queryId) {
        return liveQueryCommandsRuntime.searchQuery(queryId);
      };
      window.quepidSearch.queryCapabilities.refreshRatedDocs = function(queryId, pageSize) {
        return liveQueryCommandsRuntime.refreshRatedDocs(queryId, pageSize);
      };

      // Stimulus owns query persistence and the collection stores own the
      // rendered list. Keep only this narrow adapter for the live Angular
      // Query objects until search/scoring leave Angular as well.
      window.quepidSearch.queryCapabilities.reconcileQueryRemoval = function(queryId, rescore) {
        if (queryId === undefined || queryId === null) return false;
        return liveQueryLifecycleRuntime.reconcileQueryRemoval(queryId, rescore);
      };

      window.quepidSearch.queryCommands.rateDocument = liveQueryCommandsRuntime.rateDocument;
      window.quepidSearch.queryCommands.rateAll = liveQueryCommandsRuntime.rateAll;

      window.quepidSearch.targetedSearch = function(queryId) {
        var query = getLiveQuery(queryId);
        if (!query) return null;

        var settings = settingsSvc.editableSettings();
        var selectedTry = settings.selectedTry;
        return window.quepidSearch.queryRuntime.createTargetedSearch({
          query: query,
          queryId: queryId,
          settings: settings,
          selectedTry: selectedTry,
          engineNames: {
            solr: 'Solr',
            es: 'Elasticsearch',
            os: 'OpenSearch',
            algolia: 'Algolia',
            vectara: 'Vectara',
            static: 'Static',
            searchapi: 'Search API'
          },
          supportedEngines: ['solr', 'es', 'os', 'searchapi'],
          previewArgs: function(tryNo, queryParams) {
            return settingsSvc.previewArgs(tryNo, queryParams);
          },
          settingsWithTryOverrides: settingsWithTryOverrides,
          createSearcherFromSettings: createSearcherFromSettings,
          normalizeDocExplains: normalizeDocExplains,
          searchApiRatedDocs: searchApiRatedDocs,
          supportsRatedDocsLookup: trySupportsRatedDocsLookup,
          promiseApi: $q
        });
      };

      // Explicit command adapters for the Stimulus expanded-results renderer.
      // Query objects remain Angular-owned, but the renderer does not discover
      // them through a compiled Angular controller.
      function toggleQuery(queryId) {
        var query = getLiveQuery(queryId);
        if (!query) return false;

        var currentQuery = queryCollectionStore && queryCollectionStore.query(queryId);
        var expanded = !(currentQuery && currentQuery.expanded === true);
        if (queryCollectionStore) {
          queryCollectionStore.setExpanded(queryId, expanded);
        }
        if (queryDocumentsStore) {
          queryDocumentsStore.updateQueryState(queryId, {
            expanded: expanded
          });
        }
        return true;
      }
      window.quepidSearch.queryCommands.toggleQuery = toggleQuery;

      window.quepidSearch.queryCommands.paginateQuery = liveQueryCommandsRuntime.paginateQuery;

      // Shared "clone settings with the selectedTry overridden" pattern for a one-off preview
      // search - used by both docFinder.js's findDocsByPreviewingQueryParams() (overriding args
      // and queryParams) and searchApiRatedDocs() below (overriding just args), so a resolved
      // query doesn't have to be spliced into settings by hand at each call site.
      function settingsWithTryOverrides(settings, tryOverrides) {
        return window.quepidSearch.queryService.settingsWithTryOverrides(settings, tryOverrides);
      }

      svc.showOnlyRated = false;
      svc.isBootstrapping = false;

      /**
       * mapper_code (a try's JS source defining numberOfResultsMapper/docsMapper/
       * nextPageArgsMapper/ratedDocsQueryParamsMapper - see
       * db/mapper_based_search_engines/vespa.js) gets evaluated from two separate call sites
       * (createSearcherFromSettings below, and buildSearchApiRatedDocsQueryParams) that often
       * run back-to-back for the same try. Caching by the mapper_code string itself avoids
       * redundant `new Function` eval + window-global churn on every search/page/rated-lookup.
       *
       * The eval technique itself (Function constructor, called against `window`) only works
       * because mapper_code assigns to bare identifiers (`docsMapper = function...`, no `var`),
       * which in non-strict, non-module code are just `window.docsMapper` - so a mapper that
       * doesn't define one of these four functions would otherwise silently inherit whatever a
       * PREVIOUS, unrelated try's mapper_code last left on window. Clearing all four before
       * each eval (only reached on a cache miss) avoids that cross-contamination.
       */
      function evaluateMapperFunctions(mapperCode) {
        return window.quepidSearch.queryService.evaluateMapperFunctions(
          mapperCode,
          mapperFunctionsCache,
          window
        );
      }

      let liveQuerySearchRuntime = window.quepidSearch.liveQuerySearch.create({
        proxyUrlFor: function(searchEndpointId) {
          return caseTryNavSvc.getQuepidProxyUrl(searchEndpointId);
        },
        isEsOrOs: function(searchEngine) {
          return searchEndpointSvc.isEsOrOsEngine(searchEngine);
        },
        evaluateMapper: evaluateMapperFunctions,
        createSearcher: function(fieldSpec, searchUrl, args, queryText, searcherOptions, searchEngine) {
          return searchSvc.createSearcher(
            fieldSpec,
            searchUrl,
            args,
            queryText,
            searcherOptions,
            searchEngine
          );
        }
      });

      /**
       * Builds a splainer-search Searcher from the active try's settings and a `Query`, including
       * engine-specific behavior (proxy URL, static engine, searchapi mapper functions, rated-doc filters).
       */
      function createSearcherFromSettings(passedInSettings, query, options) {
        return liveQuerySearchRuntime.createSearcherFromSettings(passedInSettings, query, options);
      }

      function createSearcherFromSnapshot(snapshotId, query, settings) {
        var snapshotRegistry = window.quepidSearch.snapshotSearch.snapshots;
        return window.quepidSearch.snapshotSearch.createSnapshotSearcherFromRegistry({
          snapshotId: snapshotId,
          snapshots: snapshotRegistry,
          query: query,
          settings: settings,
          createRateableDoc: function(doc) {
            return query.ratingsStore.createRateableDoc(doc);
          },
          explainDoc: normalDocsSvc.explainDoc,
          promiseApi: $q,
          log: $log.error
        });
      }

      /**
       * filterToRatings() below has no generic "just these doc IDs" query syntax for a
       * searchapi engine (unlike Solr's {!terms f=id} or ES's terms query) - every mapper-based
       * engine's query language is different, so that's left to the mapper itself. If
       * mapperCode defines a ratedDocsQueryParamsMapper(ratedIds, idField) function (see
       * db/mapper_based_search_engines/vespa.js for an example), this returns the query_params
       * string it builds (evaluated via the same cache as createSearcherFromSettings - see
       * evaluateMapperFunctions above). idField is the case's own id field (fieldSpec.id, i.e.
       * whatever follows "id:" in the try's field_spec) - passed through rather than left for
       * the mapper to hardcode, since it's schema-specific and user-editable per case. Returns
       * null if the mapper doesn't define one - callers should treat that the same as
       * MapperBasedSearchEngine#supports_rated_docs_lookup being false.
       */
      function buildSearchApiRatedDocsQueryParams(mapperCode, ratedIds, idField) {
        return window.quepidSearch.queryService.buildSearchApiRatedDocsQueryParams(
          mapperCode,
          ratedIds,
          idField,
          evaluateMapperFunctions
        );
      }

      /**
       * Shared "look up already-rated docs via the mapper" pipeline for a searchapi/mapper-based
       * engine - used by both docFinder.js's "Already Rated Documents" section and
       * the framework-free query runtime (Query's "Show only rated" toggle), which otherwise
       * duplicated this same build-query-params -> previewArgs -> search -> normalize sequence.
       * Callers are expected to have already checked trySupportsSearchApiRatedDocsLookup(); this
       * resolves to null when the mapper doesn't build a query (or previewArgs can't resolve it),
       * which callers should treat as "can't show rated docs, disable/message accordingly."
       */
      function searchApiRatedDocs(settings, query, ratedIds) {
        let idField = settings.createFieldSpec().id;
        let ratedQueryParams = buildSearchApiRatedDocsQueryParams(settings.selectedTry.mapperCode, ratedIds, idField);

        if (!ratedQueryParams) {
          return $q.resolve(null);
        }

        return settingsSvc.previewArgs(settings.selectedTry.tryNo, ratedQueryParams).then(function(resolvedArgs) {
          if (resolvedArgs === null) {
            return null;
          }

          let tempSettings = settingsWithTryOverrides(settings, { args: resolvedArgs });

          // Force POST regardless of the try's own apiMethod (which may be 'AUTO' for a
          // mapper-based search engine) - a rated-docs ID filter can grow arbitrarily long as
          // more docs get rated, so this always sends it as a body rather than gambling on it
          // fitting in a GET querystring.
          let searcher = createSearcherFromSettings(tempSettings, query, { forceApiMethod: 'POST' });

          return searcher.search().then(function() {
            let normed = normalizeDocExplains(query, searcher, settings.createFieldSpec());
            return { searcher: searcher, docs: normed };
          });
        });
      }

      /**
       * A mapper (e.g. db/mapper_based_search_engines/vespa.js) may spread a per-field score
       * breakdown onto each doc as matchfeatures (Vespa's convention, e.g. {"bm25(overview)":
       * 5.07, "bm25(title)": 2.64}). The generic searchapi engine has no explain concept of
       * its own (SearchApiDocFactory#explain always returns {}), so build a synthetic explain
       * tree in the same {description, value, details} shape Solr/ES explains use — the
       * engine-agnostic bar rendering (explainSvc/normalDocsSvc) picks it up identically to
       * how it already does for Solr's real explain output. Returns undefined (falling back to
       * splainer-search's empty-explain placeholder - doc.explain().children.length === 0 - which
       * the match-explain Stimulus controller (app/javascript/controllers/match_explain_controller.js)
       * renders as "no per-term score breakdown for doc" when a doc has no matchfeatures to show.
       */
      function matchFeaturesExplain(doc) {
        return window.quepidSearch.queryService.matchFeaturesExplain(doc);
      }

      function normalizeDocExplains(query, searcher, fieldSpec) {
        return window.quepidSearch.queryService.normalizeSearchResults({
          searcher: searcher,
          fieldSpec: fieldSpec,
          extractors: {
            es: function(docs, spec) {
              return esExplainExtractorSvc.docsWithExplainOther(docs, spec);
            },
            solr: function(docs, spec, othersExplained) {
              return solrExplainExtractorSvc.docsWithExplainOther(docs, spec, othersExplained);
            }
          },
          createNormalDoc: function(spec, doc, explain) {
            return normalDocsSvc.createNormalDoc(spec, doc, explain);
          },
          createRateableDoc: function(doc) {
            return query.ratingsStore.createRateableDoc(doc);
          }
        });
      }

      function toggleShowOnlyRated() {
        svc.showOnlyRated = !svc.showOnlyRated;

        if (queryDocumentsStore) {
          queryDocumentsStore.setShowOnlyRated(svc.showOnlyRated);
        }

        if (svc.showOnlyRated) {
          angular.forEach(svc.queries, function(query) {
            if (!query.ratingsReady) {
              window.quepidSearch.queryCapabilities.refreshRatedDocs(query.queryId);
            }
          });
        }
        publishQueryListState();
      }

      function hasUnscoredQueries() {
        return unscoredQueryCount() > 0;
      }

      function unscoredQueryCount() {
        return Object.values(svc.queries).filter( (q) => {
          return !q.hasBeenScored;
        }).length;
      }

      function scoredQueryCount() {
        return Object.values(svc.queries).filter ( (q) => {
          return q.hasBeenScored;
        }).length;
      }

      function queryCount() {
        if (queryCollectionStore && queryCollectionStore.status !== 'idle') {
          return queryCollectionStore.size;
        }
        return Object.keys(svc.queries).length;
      }

      function bootstrapQueries(caseNo) {
        return liveQueryCollectionRuntime.bootstrapQueries(caseNo);
      }

      function searchAndScore(query) {
        return liveQueryTransportRuntime.searchAndScore(query);
      }

      function searchAll() {
        let searchAllPromise = liveQueryTransportRuntime.searchAll();
        searchAllPromise.catch(angular.noop);
        return searchAllPromise;
      }
      window.quepidSearch.queryCommands.searchAll = searchAll;

      this.createQuery = function(queryText) {
        let queryJson = {
          'query_text': queryText,
          queryId:      -1
        };
        let newQuery = liveQueryFactory.create(queryJson);
        liveQueryDiffRuntime.create(newQuery);
        return newQuery;
      };

      // get the full list of queries sorted by create/manual order
      // only call this when our version() changes
      function queryArray() {
        if (queryCollectionStore && queryCollectionStore.status === 'ready') {
          // Keep the legacy defaultCaseOrder contract while taking the order
          // itself from the store. Angular's existing orderBy and any other
          // consumers still rely on this field being refreshed on each read.
          return window.quepidSearch.queryState.orderedQueries(
            queryCollectionStore.orderedQueryIds(),
            svc.queries
          );
        }
        return window.quepidSearch.queryState.orderedQueries(svc.displayOrder, svc.queries);
      }

      // Temporary adapter for the Stimulus reorder controller. The controller
      // owns the PUT; Angular keeps the live display order in sync until the
      // query store becomes authoritative.
      function applyDisplayOrder(displayOrder) {
        svc.displayOrder = displayOrder;
        if (queryCollectionStore) {
          queryCollectionStore.setDisplayOrder(displayOrder);
        }
        svcVersion++;
      }

      /*
       * This method prepares the scores table that the qgraph/qscore-case/qscore-query components need.
       *
       */
      function scoreAll(scorables) {
        return scorables === undefined
          ? caseScoringRuntime.scoreAll()
          : caseScoringRuntime.scoreAll(scorables);
      }
      window.quepidSearch.queryCapabilities.scoreAll = scoreAll;

      // Refresh diff objects for all queries after state changes. The live diff
      // runtime remains Angular-backed, but its public adapter is the explicit
      // capability below rather than the legacy service namespace.
      function refreshAllDiffs() {
        return liveQueryDiffRuntime.refreshAll();
      }

      // Framework-free controllers use this adapter instead of resolving the
      // Angular service from the injector. Keep the digest boundary here with
      // the live Query implementation until diff refresh leaves Angular.
      window.quepidSearch.queryCapabilities.refreshAllDiffs = function() {
        return new Promise(function(resolve, reject) {
          $scope.$evalAsync(function() {
            refreshAllDiffs().then(resolve, reject);
          });
        });
      };

      function updateScores() {
        return liveQueryStateRuntime.updateScores();
      }
      window.quepidSearch.queryCapabilities.updateScores = updateScores;

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }
    }
  ]);
