/* jslint latedef:false */

/**
 * Creates the live-query compatibility runtime from explicit Angular service
 * dependencies. The runtime itself is framework-free; Angular only supplies
 * the still-legacy search, scoring, settings, and transport services.
 */
export function initializeLiveQueryRuntime({
  $rootScope: rootScope,
  $http: http,
  $q: promiseApi,
  $log: logger,
  scorerSvc,
  caseTryNavSvc,
  settingsSvc
}) {
      const splainerSearch = window.quepidSearch.splainerSearch || {};
      const searchSvc = splainerSearch.searchSvc;
      const normalDocsSvc = splainerSearch.normalDocsSvc;
      const esExplainExtractorSvc = splainerSearch.esExplainExtractorSvc;
      const solrExplainExtractorSvc = splainerSearch.solrExplainExtractorSvc;
      const createDocList = (docs, fieldSpec, ratingsStore, explain) => {
        const normalizedDocs = [];
        const ids = [];
        let error = "";

        (docs || []).forEach((doc, index) => {
          const altExplainJson = explain ? explain(doc) : undefined;
          const normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, altExplainJson);
          const rateableDoc = ratingsStore.createRateableDoc(normalDoc);
          if (normalDoc.id === undefined || normalDoc.id === "undefined") {
            error = `Your selected id field <strong>${fieldSpec.id}</strong> is missing on one or more results.` +
              " Quepid requires a unique identifier for each document to work correctly. Open the " +
              "<strong>Tune Relevance</strong> pane, and under <strong>Settings</strong> in the " +
              "<strong>Displayed Fields</strong> field change " +
              `<strong>id:${fieldSpec.id}</strong> to specify your unique ID field.`;
            rateableDoc.error = "ID Field Missing";
            rateableDoc.id = `${rateableDoc.error}${index}`;
          } else if (ids.includes(normalDoc.id)) {
            error = `Your selected id field <strong>${fieldSpec.id}</strong> doesn't uniquely identify individual documents.` +
              " Quepid requires a unique identifier for each document to work correctly. Open the " +
              "<strong>Tune Relevance</strong> pane, and under <strong>Settings</strong> in the " +
              "<strong>Displayed Fields</strong> field change " +
              `<strong>id:${fieldSpec.id}</strong> to specify your unique ID field.`;
            rateableDoc.error = `ID <strong>${normalDoc.id}</strong> Shared With Another Doc`;
            rateableDoc.id = `${rateableDoc.error}${index}`;
          }
          normalizedDocs.push(rateableDoc);
          ids.push(normalDoc.id);
        });

        return {
          list: () => normalizedDocs,
          hasErrors: () => error.length > 0,
          errorMsg: () => error
        };
      };
      const angularCopy = value => {
        if (value === null || typeof value !== "object") return value;
        if (Array.isArray(value)) return value.map(angularCopy);
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, angularCopy(entry)]));
      };
      const angularForEach = (items, callback) => Object.values(items || {}).forEach(callback);
      const isFunction = value => typeof value === "function";
      const $scope = rootScope;
      const $http = http;
      const $q = promiseApi;
      const $log = logger;

      const svc = {
        error: false,
        displayOrder: [],
        linkUrl: ''
      };
      let caseNo = -1;
      let currSettings = {};
      let svcVersion = 0;
      let ratingsVersion = 0;

      // Keyed by the mapper_code string itself, so a re-eval is only ever skipped for the
      // exact same code (editing a mapper - or switching to a different mapper-based try -
      // naturally busts the cache via a different key). See evaluateMapperFunctions() below.
      const mapperFunctionsCache = {};

      // Temporary dual-run bridge: the store owns the query collection snapshot
      // and display order while Angular keeps the live Query objects for search,
      // ratings, documents, and scoring.
      const queryCollectionStore = window.quepidStore && window.quepidStore.queries;
      const queryDocumentsStore = window.quepidStore && window.quepidStore.documents;
      const diffStateStore = window.quepidStore && window.quepidStore.diff;
      const liveQueryRegistry = window.quepidSearch.liveQueryRegistry.create({
        store: queryCollectionStore
      });
      function getAllDiffSettings() {
        return diffStateStore ? diffStateStore.selections() : [];
      }

      // The collection store owns membership and display order. Keep the
      // Angular map as the live-object execution index only; every runtime
      // that needs the collection receives the store-ordered live objects.
      function getLiveQueries() {
        return liveQueryRegistry.all();
      }

      function clearQueryCollection() {
        liveQueryRegistry.clear({ resetStore: true });
      }

      function registerQueryInCollection(queryId, query) {
        liveQueryRegistry.register(queryId, query);
      }

      const bookSyncRuntime = window.quepidSearch.bookSync.createRuntime({
        logger: $log
      });

      const liveQueryAdapters = window.quepidSearch.liveQueryAdapters.create({
        domain: {
          settings: {
            editable: function() {
              return settingsSvc.editableSettings();
            },
            applicable: function() {
              return settingsSvc.applicableSettings();
            },
            isTrySelected: function() {
              return settingsSvc.isTrySelected();
            },
            previewArgs: function(tryNo, queryParams) {
              return settingsSvc.previewArgs(tryNo, queryParams);
            }
          },
          scorer: {
            getDefault: function() {
              return scorerSvc.defaultScorer;
            },
            constructFromData: function(scorerData) {
              return scorerSvc.constructFromData(scorerData);
            },
            setDefault: function(scorer) {
              return scorerSvc.setDefault(scorer);
            },
            bootstrap: function(newCaseNo) {
              return scorerSvc.bootstrap(newCaseNo);
            }
          },
          navigation: {
            proxyUrlFor: function(searchEndpointId) {
              return caseTryNavSvc.getQuepidProxyUrl(searchEndpointId);
            }
          },
          search: {
            isEsOrOsEngine: function(searchEngine) {
              return searchEngine === 'es' || searchEngine === 'os';
            },
            create: function(fieldList, searchUrl, args, queryText, options, searchEngine) {
              return searchSvc.createSearcher(
                fieldList,
                searchUrl,
                args,
                queryText,
                options,
                searchEngine
              );
            }
          },
          documents: {
            createDocList: function(docs, fieldSpec, ratingsStore, explain) {
              return createDocList(docs, fieldSpec, ratingsStore, explain);
            },
            normalizeEs: function(docs, spec) {
              return esExplainExtractorSvc.docsWithExplainOther(docs, spec);
            },
            normalizeSolr: function(docs, spec, othersExplained) {
              return solrExplainExtractorSvc.docsWithExplainOther(docs, spec, othersExplained);
            },
            createNormalDoc: function(spec, doc, explain) {
              return normalDocsSvc.createNormalDoc(spec, doc, explain);
            },
            explainDoc: function(doc) {
              return normalDocsSvc.explainDoc(doc);
            }
          }
        },
        framework: {
          request: function(options) {
            return $http(options);
          },
          get: function(url) {
            return $http.get(url);
          },
          promiseApi: $q,
          schedule: function(callback) {
            return $scope.$evalAsync(callback);
          },
          applyAsync: function(callback) {
            return $scope.$applyAsync(callback);
          },
          logger: $log,
          reject: function(message) {
            return $q.reject(message);
          },
          resolve: function(value) {
            return $q.resolve(value);
          }
        },
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
                return runtimeDomain.documents.createDocList(docs, fieldSpec, ratingsStore, explain);
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
                return liveQueryAdapters.ratings.request(options);
              },
              onRatingChanged: function(changedQueryId) {
                liveQueryAdapters.ratings.changed(changedQueryId);
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
                return angularCopy(settings);
              }
            },
            searchers: {
              create: function(query, options) {
                return liveQueryAdapters.search.create(currSettings, query, options);
              },
              createRated: function(settings, query) {
                return liveQueryAdapters.search.create(settings, query, { filterToRated: true });
              },
              searchApiRatedDocs: function(settings, query, ratedIDs) {
                return searchApiRatedDocs(settings, query, ratedIDs);
              },
              supportsRated: function(aTry) {
                return trySupportsSearchApiRatedDocsLookup(aTry);
              },
              createSnapshot: function(snapshotId, query) {
                return liveQueryAdapters.search.createSnapshot(snapshotId, query, currSettings);
              }
            },
            documents: {
              normalize: function(query, searcher, fieldSpec) {
                return window.quepidSearch.queryService.normalizeSearchResults({
                  searcher: searcher,
                  fieldSpec: fieldSpec,
                  extractors: {
                    es: function(docs, spec) {
                      return runtimeDomain.documents.normalizeEs(docs, spec);
                    },
                    solr: function(docs, spec, othersExplained) {
                      return runtimeDomain.documents.normalizeSolr(docs, spec, othersExplained);
                    }
                  },
                  createNormalDoc: function(spec, doc, explain) {
                    return runtimeDomain.documents.createNormalDoc(spec, doc, explain);
                  },
                  createRateableDoc: function(doc) {
                    return query.ratingsStore.createRateableDoc(doc);
                  }
                });
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
            return runtimeDomain.scorer.getDefault();
          },
          select: function(scorerData) {
            const scorer = runtimeDomain.scorer.constructFromData(scorerData);
            return runtimeDomain.scorer.setDefault(scorer);
          },
          bootstrap: function(newCaseNo) {
            return runtimeDomain.scorer.bootstrap(newCaseNo);
          },
          run: function(scorables) {
            return scoreAll(scorables);
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
        },
        search: {
          create: function(settings, query, options) {
            return createSearcherFromSettings(settings, query, options);
          },
          createSnapshot: function(snapshotId, query, settings) {
            return createSearcherFromSnapshot(snapshotId, query, settings);
          }
        },
        ratings: {
          request: function(options) {
            return runtimeFramework.request(options);
          },
          changed: function(changedQueryId) {
            ratingsVersion++;

            if (window.quepidStore && window.quepidStore.scoring) {
              window.quepidStore.scoring.markRatingChanged(changedQueryId);
            } else {
              document.dispatchEvent(new CustomEvent('ratings:changed', {
                detail: { queryId: changedQueryId }
              }));
            }
          }
        }
      });
      const runtimeFramework = liveQueryAdapters.framework;
      const runtimeDomain = liveQueryAdapters.domain;

      document.addEventListener('case-book:associated', function() {
        // Re-fetch case data to update cached sync properties
        if (caseNo && caseNo !== -1) {
          runtimeFramework.get('api/cases/' + caseNo).then(function(response) {
            liveQueryAdapters.book.configure(caseNo, response);
          });
        }
      });

      function reset() {
        liveQueryRegistry.clear({ resetStore: true });
        svc.showOnlyRated = false;
        svc.isBootstrapping = false;
        svc.svcVersion++;
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
      const caseScoringRuntime = window.quepidSearch.queryScoring.createCaseScoringRuntime({
        getScorables: function() {
          return getLiveQueries();
        },
        promiseApi: runtimeFramework.promiseApi,
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

      const liveQueryCollectionRuntime = window.quepidSearch.queryLifecycle.createCollectionRuntime({
        request: function(caseId) {
          return runtimeFramework.request(window.quepidSearch.queryLifecycle.bootstrapRequest(caseId));
        },
        createQuery: function(queryData) {
          return liveQueryFactory.create(queryData);
        },
        createDiff: function(query) {
          window.quepidSearch.diff.createQueryDiff({
            query: query,
            diffSettings: getAllDiffSettings(),
            settings: runtimeDomain.settings.editable(),
            createSearcherFromSnapshot: createSearcherFromSnapshot
          });
        },
        clearQueries: function() {
          liveQueryRegistry.clear();
        },
        registerQuery: function(queryId, query) {
          liveQueryRegistry.register(queryId, query, { publish: false });
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
          return runtimeFramework.promiseApi.defer();
        },
        logger: runtimeFramework.logger
      });

      const liveQueryCompatibilityRuntime = window.quepidSearch.queryLifecycle.createCompatibilityRuntime({
        model: window.quepidSearch.liveQueryModel,
        factory: window.quepidSearch.liveQueryFactory,
        documents: window.quepidSearch.liveQueryDocuments,
        execution: window.quepidSearch.liveQueryExecution,
        factoryOptions: liveQueryAdapters.compatibility.factoryOptions,
        executionOptions: liveQueryAdapters.compatibility.executionOptions
      });
      const liveQueryDocumentsRuntime = liveQueryCompatibilityRuntime.documents;
      const liveQueryRuntime = liveQueryCompatibilityRuntime.execution;
      const liveQueryFactory = liveQueryCompatibilityRuntime.factory;

      const liveQueryTransportRuntime = window.quepidSearch.queryLifecycle.createTransportRuntime({
        queryRuntime: liveQueryRuntime,
        getQueries: function() {
          return getLiveQueries();
        },
        getRequestsPerMinute: function() {
          return currSettings.selectedTry.requestsPerMinute;
        },
        resetQuery: function(query) {
          liveQueryDocumentsRuntime.reset(query);
          liveQueryDocumentsRuntime.publish(query);
        },
        scoreAll: function() {
          return liveQueryAdapters.scoring.run();
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
        promiseApi: runtimeFramework.promiseApi,
        logger: runtimeFramework.logger
      });

      const liveQueryCommandsRuntime = window.quepidSearch.liveQueryCommands.create({
        getQuery: getLiveQuery,
        getShowOnlyRated: function() {
          return svc.showOnlyRated;
        },
        queryRuntime: liveQueryRuntime,
        documentRuntime: liveQueryDocumentsRuntime,
        schedule: function(callback) {
          runtimeFramework.schedule(callback);
        },
        reject: function(message) {
          return runtimeFramework.reject(message);
        }
      });

      const liveQueryEventsRuntime = window.quepidSearch.liveQueryEvents.create({
        scoringStore: window.quepidStore && window.quepidStore.scoring,
        getCaseNo: getCaseNo,
        getQuery: getLiveQuery,
        getQueries: function() {
          return getLiveQueries();
        },
        invalidateRatedDocs: function(query) {
          window.quepidSearch.queryState.invalidateRatedDocsCache(query);
        },
        publishQuery: publishQueryDocuments,
        scoreAll: function() {
          return liveQueryAdapters.scoring.run();
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
          runtimeFramework.schedule(callback);
        },
        scheduleApply: function(callback) {
          runtimeFramework.applyAsync(callback);
        }
      });
      liveQueryEventsRuntime.connect();

      const liveQueryLifecycleRuntime = window.quepidSearch.queryLifecycle.createRuntime({
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
          clearQueryCollection();
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
          registerQueryInCollection(queryId, query);
        },
        onVersion: function() {
          svcVersion++;
        },
        removeQuery: function(queryId) {
          return liveQueryRegistry.remove(queryId);
        },
        searchAndScore: function(query) {
          return searchAndScore(query);
        },
        updateScores: function() {
          window.quepidSearch.queryCapabilities.updateScores();
        },
        logger: runtimeFramework.logger
      });

      const liveQueryDiffRuntime = window.quepidSearch.liveQueryDiff.create({
        getQueries: function() {
          return getLiveQueries();
        },
        getDiffSettings: getAllDiffSettings,
        getSettings: function() {
          return runtimeDomain.settings.editable();
        },
        createSearcherFromSnapshot: createSearcherFromSnapshot,
        publish: publishQueryDocuments,
        notify: function(detail) {
          document.dispatchEvent(new CustomEvent('query-diffs:refreshed', {
            detail: detail
          }));
        },
        promiseApi: runtimeFramework.promiseApi
      });

      const liveQueryStateRuntime = window.quepidSearch.liveQueryState.create({
        getQueries: function() {
          return getLiveQueries();
        },
        scoreAll: function(scorables) {
          return scorables === undefined
            ? liveQueryAdapters.scoring.run()
            : liveQueryAdapters.scoring.run(scorables);
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
          runtimeFramework.get('api/cases/' + newCaseNo).then(function(response) {
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
        promiseApi: runtimeFramework.promiseApi
      });

      window.quepidSearch.queryCapabilities.getListState = function() {
        const selectedTry = runtimeDomain.settings.applicable() || {};
        return {
          canAddQueries: selectedTry.searchEngine !== 'static',
          addQueryMessage: selectedTry.searchEngine === 'static' ? 'Adding queries is not supported' : 'Add a query to this case',
          showOnlyRated: svc.showOnlyRated === true,
          // Match the query-list controller's showOnlyRatedUnsupported state: while the case is
          // still loading, no selected try means the capability is unknown,
          // not unsupported.
          showOnlyRatedUnsupported: runtimeDomain.settings.isTrySelected() ? !trySupportsRatedDocsLookup(selectedTry) : false,
          isBootstrapping: svc.isBootstrapping === true,
          searching: hasUnscoredQueries(),
          batchPosition: scoredQueryCount(),
          batchSize: queryCount()
        };
      };
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

        const effectiveScorer = isFunction(query.effectiveScorer) ? query.effectiveScorer() : null;
        let ratingScale = query.ratings && query.ratings.scale;
        if (!ratingScale && effectiveScorer && isFunction(effectiveScorer.getColors)) {
          ratingScale = effectiveScorer.getColors();
        }
        const applicableSettings = runtimeDomain.settings.applicable() || {};
        const readModel = window.quepidSearch.queryDocuments.buildState({
          query: query,
          settings: applicableSettings,
          selectedTry: applicableSettings.selectedTry || {},
          ratingScale: ratingScale || {},
          diffs: buildDiffReadModel(query),
          documentUrlFor: function(doc) {
            if (!doc || !isFunction(doc._url)) return null;

            let linkUrl;
            try {
              linkUrl = doc._url();
            } catch {
              return null;
            }
            if (applicableSettings.basicAuthCredential) {
              linkUrl = linkUrl.replace('://', '://' + applicableSettings.basicAuthCredential + '@');
            }
            if (applicableSettings.proxyRequests === true) {
              linkUrl = runtimeDomain.navigation.proxyUrlFor(applicableSettings.searchEndpointId) + linkUrl;
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
        if (!query || !query.diffs || !isFunction(query.diffs.getSearchers)) {
          return null;
        }

        const showOnlyRated = svc.showOnlyRated === true;
        return {
          searchers: query.diffs.getSearchers().map(function(searcher, index) {
            const score = searcher.diffScore || { score: '?', allRated: false };
            const docs = query.diffs.docs(index, false) || [];
            const ratedDocs = query.diffs.docs(index, true) || [];
            const maxDocScore = docs.reduce(function(max, doc) {
              return Math.max(max, isFunction(doc.score) ? doc.score() : 0);
            }, 0);

            return {
              name: isFunction(searcher.name) ? searcher.name() : 'Snapshot',
              version: isFunction(searcher.version) ? searcher.version() : null,
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
        return liveQueryRegistry.get(queryId);
      }

      // Explicit command adapters for the Stimulus expanded-results renderer.
      // Query objects remain Angular-owned, but the renderer does not discover
      // them through a compiled Angular controller.
      function toggleQuery(queryId) {
        const query = getLiveQuery(queryId);
        if (!query) return false;

        const currentQuery = queryCollectionStore && queryCollectionStore.query(queryId);
        const expanded = !(currentQuery && currentQuery.expanded === true);
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

      const liveQuerySearchRuntime = window.quepidSearch.liveQuerySearch.create({
        proxyUrlFor: function(searchEndpointId) {
            return runtimeDomain.navigation.proxyUrlFor(searchEndpointId);
        },
        isEsOrOs: function(searchEngine) {
            return runtimeDomain.search.isEsOrOsEngine(searchEngine);
        },
        evaluateMapper: evaluateMapperFunctions,
        createSearcher: function(fieldSpec, searchUrl, args, queryText, searcherOptions, searchEngine) {
            return runtimeDomain.search.create(
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
        const snapshotRegistry = window.quepidSearch.snapshotSearch.snapshots;
        return window.quepidSearch.snapshotSearch.createSnapshotSearcherFromRegistry({
          snapshotId: snapshotId,
          snapshots: snapshotRegistry,
          query: query,
          settings: settings,
          createRateableDoc: function(doc) {
            return query.ratingsStore.createRateableDoc(doc);
          },
          explainDoc: runtimeDomain.documents.explainDoc,
          promiseApi: runtimeFramework.promiseApi,
          log: runtimeFramework.logger.error
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
        const idField = settings.createFieldSpec().id;
        const ratedQueryParams = buildSearchApiRatedDocsQueryParams(settings.selectedTry.mapperCode, ratedIds, idField);

        if (!ratedQueryParams) {
          return runtimeFramework.resolve(null);
        }

        return runtimeDomain.settings.previewArgs(settings.selectedTry.tryNo, ratedQueryParams).then(function(resolvedArgs) {
          if (resolvedArgs === null) {
            return null;
          }

          const tempSettings = settingsWithTryOverrides(settings, { args: resolvedArgs });

          // Force POST regardless of the try's own apiMethod (which may be 'AUTO' for a
          // mapper-based search engine) - a rated-docs ID filter can grow arbitrarily long as
          // more docs get rated, so this always sends it as a body rather than gambling on it
          // fitting in a GET querystring.
          const searcher = createSearcherFromSettings(tempSettings, query, { forceApiMethod: 'POST' });

          return searcher.search().then(function() {
            const normed = liveQueryAdapters.compatibility.executionOptions.documents.normalize(
              query,
              searcher,
              settings.createFieldSpec()
            );
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

      function toggleShowOnlyRated() {
        svc.showOnlyRated = !svc.showOnlyRated;

        if (queryDocumentsStore) {
          queryDocumentsStore.setShowOnlyRated(svc.showOnlyRated);
        }

        if (svc.showOnlyRated) {
          angularForEach(getLiveQueries(), function(query) {
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
        return Object.values(getLiveQueries()).filter( (q) => {
          return !q.hasBeenScored;
        }).length;
      }

      function scoredQueryCount() {
        return Object.values(getLiveQueries()).filter ( (q) => {
          return q.hasBeenScored;
        }).length;
      }

      function queryCount() {
        if (queryCollectionStore && queryCollectionStore.status !== 'idle') {
          return queryCollectionStore.size;
        }
        return Object.keys(getLiveQueries()).length;
      }

      function bootstrapQueries(caseNo) {
        return liveQueryCollectionRuntime.bootstrapQueries(caseNo);
      }

      function searchAndScore(query) {
        return liveQueryTransportRuntime.searchAndScore(query);
      }

      function searchAll() {
        const searchAllPromise = liveQueryTransportRuntime.searchAll();
        searchAllPromise.catch(() => {});
        return searchAllPromise;
      }

      function createQuery(queryText) {
        const queryJson = {
          'query_text': queryText,
          queryId:      -1
        };
        const newQuery = liveQueryFactory.create(queryJson);
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
            getLiveQueries()
          );
        }
        return window.quepidSearch.queryState.orderedQueries(svc.displayOrder, getLiveQueries());
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

      // Refresh diff objects for all queries after state changes. The live diff
      // runtime remains Angular-backed, but its public adapter is the explicit
      // capability below rather than the legacy service namespace.
      function refreshAllDiffs() {
        return liveQueryDiffRuntime.refreshAll();
      }

      // Framework-free controllers use this adapter instead of resolving the
      // Angular service from the injector. Keep the digest boundary here with
      // the live Query implementation until diff refresh leaves Angular.
      function refreshAllDiffsCapability() {
        return new Promise(function(resolve, reject) {
          runtimeFramework.schedule(function() {
            refreshAllDiffs().then(resolve, reject);
          });
        });
      }

      function updateScores() {
        return liveQueryStateRuntime.updateScores();
      }

      window.quepidSearch.liveQueryCapabilities.install({
        target: window.quepidSearch,
        capabilities: {
          getListState: function() {
            const selectedTry = runtimeDomain.settings.applicable() || {};
            return {
              canAddQueries: selectedTry.searchEngine !== 'static',
              addQueryMessage: selectedTry.searchEngine === 'static' ? 'Adding queries is not supported' : 'Add a query to this case',
              showOnlyRated: svc.showOnlyRated === true,
              showOnlyRatedUnsupported: runtimeDomain.settings.isTrySelected() ? !trySupportsRatedDocsLookup(selectedTry) : false,
              isBootstrapping: svc.isBootstrapping === true,
              searching: hasUnscoredQueries(),
              batchPosition: scoredQueryCount(),
              batchSize: queryCount()
            };
          },
          isSortingEnabled: function() {
            return false;
          },
          setDisplayOrder: applyDisplayOrder,
          getQuery: getLiveQuery,
          createQuery: createQuery,
          registerQuery: registerQueryInCollection,
          getQueries: getLiveQueries,
          getCaseNo: getCaseNo,
          resetQueryState: reset,
          bootstrapQueries: bootstrapQueries,
          resetSearchPromise: function() {
            liveQueryCollectionRuntime.resetSearchPromise();
          },
          getQueryArray: queryArray,
          getVersion: function() {
            return svcVersion + ratingsVersion;
          },
          changeSettings: function(newCaseNo, newSettings) {
            return liveQueryStateRuntime.changeSettings(newCaseNo, newSettings);
          },
          resetQuery: function(queryId) {
            const query = getLiveQuery(queryId);
            if (!query) return false;
            liveQueryDocumentsRuntime.reset(query);
            publishQueryDocuments(query);
            return true;
          },
          searchQuery: function(queryId) {
            return liveQueryCommandsRuntime.searchQuery(queryId);
          },
          refreshRatedDocs: function(queryId, pageSize) {
            return liveQueryCommandsRuntime.refreshRatedDocs(queryId, pageSize);
          },
          reconcileQueryRemoval: function(queryId, rescore) {
            if (queryId === undefined || queryId === null) return false;
            return liveQueryLifecycleRuntime.reconcileQueryRemoval(queryId, rescore);
          },
          refreshAllDiffs: refreshAllDiffsCapability,
          scoreAll: scoreAll,
          updateScores: updateScores
        },
        commands: {
          rateDocument: liveQueryCommandsRuntime.rateDocument,
          rateAll: liveQueryCommandsRuntime.rateAll,
          toggleQuery: toggleQuery,
          paginateQuery: liveQueryCommandsRuntime.paginateQuery,
          toggleShowOnlyRated: toggleShowOnlyRated,
          searchAll: searchAll,
          collapseAll: function() {
            if (queryDocumentsStore) queryDocumentsStore.collapseAll();
          }
        },
        lifecycle: {
          prepareQueries: liveQueryLifecycleRuntime.prepareQueries,
          commitQueries: liveQueryLifecycleRuntime.commitQueries.bind(liveQueryLifecycleRuntime),
          commitPersistedQueries: liveQueryLifecycleRuntime.commitPersistedQueries,
          refreshQueries: liveQueryLifecycleRuntime.refreshQueries
        },
        targetedSearch: function(queryId) {
          const query = getLiveQuery(queryId);
          if (!query) return null;

          const settings = runtimeDomain.settings.editable();
          return window.quepidSearch.queryRuntime.createTargetedSearch({
            query: query,
            queryId: queryId,
            settings: settings,
            selectedTry: settings.selectedTry,
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
              return runtimeDomain.settings.previewArgs(tryNo, queryParams);
            },
            settingsWithTryOverrides: settingsWithTryOverrides,
            createSearcherFromSettings: createSearcherFromSettings,
            normalizeDocExplains: liveQueryAdapters.compatibility.executionOptions.documents.normalize,
            searchApiRatedDocs: searchApiRatedDocs,
            supportsRatedDocsLookup: trySupportsRatedDocsLookup,
            promiseApi: runtimeFramework.promiseApi
          });
        }
      });

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }

      return window.quepidSearch;
}
