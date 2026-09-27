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
    'broadcastSvc',
    'scorerSvc',
    'searchSvc',
    'queryViewSvc',
    'ratingsStoreSvc',
    'caseTryNavSvc',
    'querySnapshotSvc',
    'bookSvc',
    'DocListFactory',
    'searchErrorTranslatorSvc',
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
      broadcastSvc,
      scorerSvc,
      searchSvc,
      queryViewSvc,
      ratingsStoreSvc,
      caseTryNavSvc,
      querySnapshotSvc,
      bookSvc,
      DocListFactory,
      searchErrorTranslatorSvc,
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
      this.displayOrder = [];
      this.queries = {};
      this.linkUrl = '';

      // Cached case-book sync properties (updated via broadcasts from caseSvc)
      let cachedBookId = null;
      let cachedAutoPopulateBookPairs = false;

      $scope.$on('associateBook', function() {
        // Re-fetch case data to update cached sync properties
        if (caseNo && caseNo !== -1) {
          $http.get('api/cases/' + caseNo).then(function(response) {
            cachedBookId = response.data.book_id;
            cachedAutoPopulateBookPairs = response.data.auto_populate_book_pairs;
          });
        }
      });

      // Cache for tracking synced query-doc pairs per book
      // Format: { bookId: { 'queryText:docId': true } }
      let syncedPairsCache = {};

      svc.reset = reset;
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
        publishQueryListState();
        // Clear sync cache when resetting
        syncedPairsCache = {};
      }

      // Explicit adapter for the Stimulus query list. Angular retains the live
      // Query objects, but the list no longer discovers them through an
      // Angular controller scope.
      function publishQueryListState() {
        document.dispatchEvent(new CustomEvent('queries-state:changed'));
      }

      window.quepidSearch.queryState.getListState = function() {
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
          searching: svc.hasUnscoredQueries(),
          batchPosition: svc.scoredQueryCount(),
          batchSize: svc.queryCount()
        };
      };
      window.quepidSearch.queryState.toggleShowOnlyRated = toggleShowOnlyRated;
      window.quepidSearch.queryState.isSortingEnabled = function() {
        return false;
      };
      window.quepidSearch.queryState.collapseAll = function() {
        queryViewSvc.collapseAll();
        if (queryDocumentsStore) queryDocumentsStore.collapseAll();
      };
      window.quepidSearch.queryState.setDisplayOrder = function(displayOrder) {
        svc.applyDisplayOrder(displayOrder);
      };

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
      this.buildSearchApiRatedDocsQueryParams = buildSearchApiRatedDocsQueryParams;
      this.searchApiRatedDocs = searchApiRatedDocs;
      this.trySupportsSearchApiRatedDocsLookup = trySupportsSearchApiRatedDocsLookup;
      this.trySupportsRatedDocsLookup = trySupportsRatedDocsLookup;
      this.settingsWithTryOverrides = settingsWithTryOverrides;
      this.normalizeDocExplains = normalizeDocExplains;
      this.toggleShowOnlyRated = toggleShowOnlyRated;
      // Temporary adapter for the Stimulus query-lifecycle controller. The
      // controller owns persistence and the user-facing workflow; this service
      // still owns Query construction, search, and scoring until those seams migrate.
      window.quepidSearch.queryLifecycle.prepareQueries = prepareQueries;
      window.quepidSearch.queryLifecycle.commitQueries = commitQueries;
      window.quepidSearch.queryLifecycle.commitPersistedQueries = commitPersistedQueries;
      window.quepidSearch.queryLifecycle.refreshQueries = refreshQueries;

      function refreshQueries(caseId) {
        svc.reset();
        return svc.bootstrapQueries(caseId).then(function() {
          return svc.searchAll();
        });
      }

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

        queryDocumentsStore.replaceQuery(query.queryId, {
          queryText: query.queryText,
          fieldSpec: (function() {
            var fieldSpec = angular.isFunction(query.fieldSpec) ? query.fieldSpec() : {};
            return {
              fields: (fieldSpec.fields || []).slice(),
              id: fieldSpec.id,
              title: fieldSpec.title
            };
          }()),
          docs: query.docs,
          ratedDocs: query.ratedDocs,
          numFound: query.numFound,
          ratedDocsFound: query.ratedDocsFound,
          ratedDocsUnsupported: query.ratedDocsUnsupported,
          paginationSupported: (function() {
            var selectedTry = settingsSvc.applicableSettings() || {};
            return selectedTry.searchEngine !== 'searchapi' || selectedTry.mapperBasedSearchEngineSupportsPagination === true;
          }()),
          resultsView: 2,
          errorText: query.errorText,
          depthOfRating: query.depthOfRating,
          ratingScale: ratingScale || {},
          queryRating: query.rating,
          missingRatings: query.currentScore ? query.currentScore.countMissingRatings : null,
          allRated: query.currentScore ? query.currentScore.allRated : false,
          maxDocScore: angular.isFunction(query.maxDocScore) ? query.maxDocScore() : null,
          browseUrl: angular.isFunction(query.browseUrl) ? query.browseUrl() : null,
          searchEngine: (settingsSvc.applicableSettings() || {}).searchEngine,
          apiMethod: (settingsSvc.applicableSettings() || {}).apiMethod,
          mapperBasedSearchEngineName: (settingsSvc.applicableSettings() || {}).mapperBasedSearchEngineName,
          browseHeaders: (function() {
            var settings = settingsSvc.applicableSettings() || {};
            var headers = settings.customHeaders;
            if (typeof headers === 'string') {
              try { headers = JSON.parse(headers); } catch { headers = {}; }
            }
            headers = headers && typeof headers === 'object' && !Array.isArray(headers) ? angular.copy(headers) : {};
            if (settings.basicAuthCredential) {
              headers.Authorization = 'Basic ' + window.btoa(settings.basicAuthCredential);
            }
            return headers;
          }()),
          queryState: angular.isFunction(query.state) ? query.state() : null,
          documentUrlFor: function(doc) {
            if (!doc || !angular.isFunction(doc._url)) return null;

            var linkUrl;
            try {
              linkUrl = doc._url();
            } catch {
              return null;
            }
            var settings = settingsSvc.applicableSettings() || {};
            if (settings.basicAuthCredential) {
              linkUrl = linkUrl.replace('://', '://' + settings.basicAuthCredential + '@');
            }
            if (settings.proxyRequests === true) {
              linkUrl = caseTryNavSvc.getQuepidProxyUrl(settings.searchEndpointId) + linkUrl;
            }
            return linkUrl;
          },
          version: angular.isFunction(query.version) ? query.version() : null
          ,diffs: buildDiffReadModel(query)
        });
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
      window.quepidSearch.queryState.getQuery = function(queryId) {
        return svc.queries[queryId] || svc.queries[String(queryId)] || null;
      };

      function rateDocument(queryId, docId, rating) {
        var query = window.quepidSearch.queryState.getQuery(queryId);
        if (!query) return false;

        var docs = (query.docs || []).concat(query.ratedDocs || []);
        var doc = docs.find(function(candidate) {
          return String(candidate.id) === String(docId);
        });
        if (!doc) return false;

        $scope.$evalAsync(function() {
          if (rating === null || rating === undefined) {
            doc.resetRating();
          } else {
            doc.rate(parseInt(rating, 10));
          }
          query.touchModifiedAt();
        });
        return true;
      }
      window.quepidSearch.queryState.rateDocument = rateDocument;

      function rateAll(queryId, rating) {
        var query = window.quepidSearch.queryState.getQuery(queryId);
        if (!query) return false;

        var docs = svc.showOnlyRated ? query.ratedDocs : query.docs;
        if (!docs || docs.length === 0) return true;

        var ids = docs.map(function(doc) { return doc.id; });
        $scope.$evalAsync(function() {
          if (rating === null || rating === undefined) {
            docs[0].resetBulkRatings(ids);
            query.rating = '--';
          } else {
            docs[0].rateBulk(ids, parseInt(rating, 10));
            query.rating = parseInt(rating, 10);
          }
          query.touchModifiedAt();
        });
        return true;
      }
      window.quepidSearch.queryState.rateAll = rateAll;

      // Explicit adapter for the Stimulus Missing Documents modal. The modal owns
      // its DOM and lifecycle, while this service continues to own searcher creation,
      // engine-specific rated-document lookup, and live rateable document objects.
      window.quepidSearch.targetedSearch = function(queryId) {
        var query = window.quepidSearch.queryState.getQuery(queryId);
        if (!query) return null;

        var settings = settingsSvc.editableSettings();
        var selectedTry = settings.selectedTry;
        var supportedEngines = ['solr', 'es', 'os', 'searchapi'];
        var engineNames = {
          solr: 'Solr',
          es: 'Elasticsearch',
          os: 'OpenSearch',
          algolia: 'Algolia',
          vectara: 'Vectara',
          static: 'Static',
          searchapi: 'Search API'
        };
        var engineName = selectedTry.mapperBasedSearchEngineName || settings.searchEngine;
        var adapter = {
          queryId: queryId,
          query: query,
          queryText: query.queryText,
          settings: settings,
          engineName: engineNames[engineName] || engineName,
          usesQueryParamsEditor: supportedEngines.indexOf(settings.searchEngine) !== -1,
          docs: [],
          searcher: null,
          defaultList: false,
          lastQuery: '',
          parseError: false,
          searching: false,
          paging: false,
          ratedDocsLookupUnsupported: false,
          totalRatings: 0,
          numFound: 0,
          ratingScale: query.ratings && query.ratings.scale ? query.ratings.scale : {}
        };

        adapter.initialQueryParams = function() {
          return selectedTry.queryParams ? selectedTry.queryParams.replace(/#\$query##/g, function() {
            return query.queryText;
          }) : selectedTry.queryParams;
        };

        adapter.search = function(queryParams) {
          var fieldSpec = settings.createFieldSpec();
          adapter.defaultList = false;
          adapter.searching = true;
          return settingsSvc.previewArgs(selectedTry.tryNo, queryParams).then(function(resolvedArgs) {
            adapter.searching = false;
            adapter.lastQuery = queryParams;
            if (resolvedArgs === null) {
              adapter.numFound = 0;
              adapter.docs = [];
              adapter.parseError = true;
              return adapter;
            }

            adapter.parseError = false;
            var tempSettings = settingsWithTryOverrides(settings, {
              args: resolvedArgs,
              queryParams: queryParams
            });
            adapter.searcher = createSearcherFromSettings(tempSettings, query);
            return adapter.searcher.search().then(function() {
              adapter.numFound = adapter.searcher.numFound;
              adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec);
              return adapter;
            });
          });
        };

        adapter.resetToRated = function() {
          adapter.docs = [];
          adapter.lastQuery = '';
          adapter.parseError = false;
          adapter.defaultList = true;
          adapter.ratedDocsLookupUnsupported = false;

          var fieldSpec = settings.createFieldSpec();
          var ratedIds = Object.keys(query.ratings || {}).filter(function(id) { return id.length > 0; });
          adapter.totalRatings = ratedIds.length;
          adapter.numFound = ratedIds.length;
          if (!adapter.usesQueryParamsEditor || ratedIds.length === 0) return Promise.resolve(adapter);

          adapter.searcher = createSearcherFromSettings(settings, query);
          if (!trySupportsRatedDocsLookup(selectedTry)) {
            adapter.ratedDocsLookupUnsupported = true;
            adapter.numFound = 0;
            return Promise.resolve(adapter);
          }

          if (adapter.searcher.type === 'searchapi') {
            return searchApiRatedDocs(settings, query, ratedIds).then(function(result) {
              if (result) {
                adapter.searcher = result.searcher;
                adapter.docs = result.docs;
              }
              return adapter;
            });
          }

          if (adapter.searcher.type === 'es' || adapter.searcher.type === 'os') {
            var filter = { query: query.filterToRatings(settings, adapter.docs.length) };
            if (adapter.searcher.isTemplateCall(adapter.searcher.args)) {
              delete adapter.searcher.args.id;
              delete adapter.searcher.args.params;
              adapter.searcher.queryDsl = filter;
              return adapter.searcher.search(filter).then(function() {
                adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec);
                return adapter;
              });
            }
            adapter.searcher.queryDsl = filter;
            return adapter.searcher.search().then(function() {
              adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec);
              return adapter;
            });
          }

          if (adapter.searcher.type === 'solr') {
            delete adapter.searcher.args.start;
            return adapter.searcher.explainOther(
              query.filterToRatings(settings, adapter.docs.length), fieldSpec, 'lucene'
            ).then(function() {
              adapter.docs = normalizeDocExplains(query, adapter.searcher, fieldSpec);
              return adapter;
            });
          }

          return Promise.resolve(adapter);
        };

        adapter.paginate = function() {
          if (!adapter.searcher) return Promise.resolve(adapter);
          adapter.paging = true;

          if (adapter.defaultList && (adapter.searcher.type === 'solr' || adapter.searcher.type === 'es' || adapter.searcher.type === 'os')) {
            var ratedFieldSpec = settings.createFieldSpec();
            adapter.searcher = createSearcherFromSettings(settings, query, { filterToRated: true });
            if (adapter.searcher.type === 'es' || adapter.searcher.type === 'os') {
              var ratedFilter = { query: query.filterToRatings(settings, adapter.docs.length) };
              if (adapter.searcher.isTemplateCall(adapter.searcher.args)) {
                delete adapter.searcher.args.id;
                delete adapter.searcher.args.params;
                adapter.searcher.queryDsl = ratedFilter;
                return adapter.searcher.search(ratedFilter).then(function() {
                  adapter.docs = adapter.docs.concat(normalizeDocExplains(query, adapter.searcher, ratedFieldSpec));
                  adapter.paging = false;
                  return adapter;
                });
              }
              adapter.searcher.queryDsl = ratedFilter;
              return adapter.searcher.search().then(function() {
                adapter.docs = adapter.docs.concat(normalizeDocExplains(query, adapter.searcher, ratedFieldSpec));
                adapter.paging = false;
                return adapter;
              });
            }
            delete adapter.searcher.args.start;
            return adapter.searcher.explainOther(
              query.filterToRatings(settings, adapter.docs.length), ratedFieldSpec, 'lucene'
            ).then(function() {
              adapter.docs = adapter.docs.concat(normalizeDocExplains(query, adapter.searcher, ratedFieldSpec));
              adapter.paging = false;
              return adapter;
            });
          }

          adapter.searcher = adapter.searcher.pager();
          if (!adapter.searcher) {
            adapter.paging = false;
            return Promise.resolve(adapter);
          }
          return adapter.searcher.search().then(function() {
            var fieldSpec = settings.createFieldSpec();
            adapter.numFound = adapter.searcher.numFound;
            adapter.docs = adapter.docs.concat(normalizeDocExplains(query, adapter.searcher, fieldSpec));
            adapter.paging = false;
            return adapter;
          });
        };

        adapter.rate = function(docId, rating) {
          var doc = adapter.docs.find(function(candidate) { return String(candidate.id) === String(docId); });
          if (!doc) return false;
          if (rating === null || rating === undefined) doc.resetRating();
          else doc.rate(parseInt(rating, 10));
          query.touchModifiedAt();
          return true;
        };

        adapter.rateAll = function(rating) {
          if (adapter.docs.length === 0) return true;
          var ids = adapter.docs.map(function(doc) { return doc.id; });
          if (rating === null || rating === undefined) adapter.docs[0].resetBulkRatings(ids);
          else adapter.docs[0].rateBulk(ids, parseInt(rating, 10));
          query.touchModifiedAt();
          return true;
        };

        return adapter;
      };

      // Explicit command adapters for the Stimulus expanded-results renderer.
      // Query objects remain Angular-owned, but the renderer does not discover
      // them through a compiled Angular controller.
      function toggleQuery(queryId) {
        var query = window.quepidSearch.queryState.getQuery(queryId);
        if (!query) return false;

        queryViewSvc.toggleQuery(queryId);
        var expanded = queryViewSvc.isQueryToggled(queryId);
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
      window.quepidSearch.queryState.toggleQuery = toggleQuery;

      function paginateQuery(queryId, ratedOnly) {
        var query = window.quepidSearch.queryState.getQuery(queryId);
        if (!query) return false;

        $scope.$evalAsync(function() {
          if (ratedOnly) {
            query.ratedPaginate();
          } else {
            query.paginate();
          }
        });
        return true;
      }
      window.quepidSearch.queryState.paginateQuery = paginateQuery;

      // Shared "clone settings with the selectedTry overridden" pattern for a one-off preview
      // search - used by both docFinder.js's findDocsByPreviewingQueryParams() (overriding args
      // and queryParams) and searchApiRatedDocs() below (overriding just args), so a resolved
      // query doesn't have to be spliced into settings by hand at each call site.
      function settingsWithTryOverrides(settings, tryOverrides) {
        return window.quepidSearch.queryService.settingsWithTryOverrides(settings, tryOverrides);
      }

      svc.bootstrapQueries = bootstrapQueries;
      svc.showOnlyRated = false;
      svc.isBootstrapping = false;

      // Rescore on ratings update. The store is the native event source during
      // the migration; keep the Angular listener as a fallback for older bundles.
      var ratingChangedHandler = function(event, legacyQueryId) {
        var queryId = window.quepidSearch.queryState.ratingChangedQueryId(event, legacyQueryId);
        if (queryId !== undefined && svc.queries[queryId]) {
          window.quepidSearch.queryState.invalidateRatedDocsCache(svc.queries[queryId]);
          publishQueryDocuments(svc.queries[queryId]);
        } else {
          angular.forEach(svc.queries, publishQueryDocuments);
        }
        $scope.$evalAsync(function() {
          svc.scoreAll();
        });
      };
      if (window.quepidStore && window.quepidStore.scoring) {
        window.quepidStore.scoring.addEventListener('rating-changed', ratingChangedHandler);
      } else {
        $scope.$on('rating-changed', ratingChangedHandler);
      }

      // Stimulus pick-scorer-core: API save already done; apply scorer + rescore live queries.
      document.addEventListener('query-options:saved', function(event) {
        var detail = event.detail || {};
        var query = svc.queries[detail.queryId] || svc.queries[String(detail.queryId)];
        if (Number(detail.caseId) && Number(detail.caseId) !== Number(svc.getCaseNo())) {
          return;
        }
        if (!query || detail.options === undefined) {
          return;
        }
        $scope.$evalAsync(function() {
          query.options = detail.options;
          query.setDirty();
          svc.updateScores();
        });
      });

      // Stimulus owns query command persistence. These events only reconcile
      // the still-live Angular Query objects until the query store becomes
      // authoritative; they must not issue a second API request.
      document.addEventListener('query-command:delete-completed', function(event) {
        var detail = event.detail || {};
        var queryId = detail.queryId;
        if (queryId === undefined || queryId === null) {
          return;
        }
        delete svc.queries[queryId];
        svcVersion++;
      });

      document.addEventListener('query-command:move-completed', function(event) {
        var detail = event.detail || {};
        if (Number(detail.caseId) !== Number(svc.getCaseNo()) ||
            detail.queryId === undefined || detail.queryId === null) {
          return;
        }
        delete svc.queries[detail.queryId];
        svcVersion++;
        svc.updateScores();
      });

      // Stimulus pick-scorer-core: API save already done; apply scorer + rescore live queries.
      document.addEventListener('pick-scorer:selected', function(event) {
        var detail = event.detail || {};
        if (Number(detail.caseId) !== Number(svc.getCaseNo()) || !detail.scorer) {
          return;
        }
        $scope.$applyAsync(function() {
          var scorer = scorerSvc.constructFromData(detail.scorer);
          scorerSvc.setDefault(scorer).then(function() {
            svc.updateScores();
          });
        });
      });

      // Stimulus judgements-core: populate book needs live searched docs from this service.
      document.addEventListener('judgements:populate-book', function(event) {
        var detail = event.detail || {};
        if (Number(detail.caseId) !== Number(svc.getCaseNo())) {
          if (detail.done) { detail.done('case mismatch'); }
          return;
        }
        bookSvc.updateQueryDocPairs(detail.bookId, detail.caseId, svc.queryArray())
          .then(function() {
            if (detail.done) { detail.done(null); }
          }, function(response) {
            var message = (response && response.data && response.data.statusText) ||
              (response && response.statusText) ||
              'error';
            if (detail.done) { detail.done(message); }
          });
      });

      // Stimulus judgements-core: after ratings refresh, re-bootstrap queries + search.
      document.addEventListener('judgements:queries-need-reload', function(event) {
        var detail = event.detail || {};
        if (Number(detail.caseId) !== Number(svc.getCaseNo())) {
          return;
        }
        $scope.$applyAsync(function() {
          svc.reset();
          svc.bootstrapQueries(detail.caseId)
            .then(function() {
              svc.searchAll();
            });
        });
      });

      // Stimulus import-ratings-core: imported data needs the same live query
      // refresh as the judgements modal.
      document.addEventListener('imports:queries-need-reload', function(event) {
        var detail = event.detail || {};
        if (Number(detail.caseId) !== Number(svc.getCaseNo())) {
          return;
        }
        $scope.$applyAsync(function() {
          svc.reset();
          svc.bootstrapQueries(detail.caseId)
            .then(function() {
              svc.searchAll();
            });
        });
      });

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

      /**
       * Builds a splainer-search Searcher from the active try's settings and a `Query`, including
       * engine-specific behavior (proxy URL, static engine, searchapi mapper functions, rated-doc filters).
       */
      function createSearcherFromSettings(passedInSettings, query, options) {
        options = options == null ? {} : options;
        if (!passedInSettings || !passedInSettings.selectedTry) return;

        let mapperFunctions = passedInSettings.searchEngine === 'searchapi'
          ? evaluateMapperFunctions(passedInSettings.mapperCode)
          : {};
        let request = window.quepidSearch.queryService.buildSearcherRequest({
          settings: passedInSettings,
          queryText: query.queryText,
          queryOptions: query.options,
          options: options,
          mapperFunctions: mapperFunctions,
          proxyUrl: passedInSettings.proxyRequests === true
            ? caseTryNavSvc.getQuepidProxyUrl(passedInSettings.searchEndpointId)
            : undefined,
          isEsOrOs: searchEndpointSvc.isEsOrOsEngine(passedInSettings.searchEngine),
          ratingsFilter: options.filterToRated ? query.filterToRatings(passedInSettings) : undefined
        });

        // Preserve the legacy normalization because later Query methods read
        // the active settings object when constructing rated-doc searchers.
        passedInSettings.searchEngine = request.searchEngine;
        return searchSvc.createSearcher(
          passedInSettings.createFieldSpec(),
          passedInSettings.selectedTry.searchUrl,
          request.args,
          request.queryText,
          request.searcherOptions,
          request.searchEngine
        );
      }

      function createSearcherFromSnapshot(snapshotId, query, settings) {
        return window.quepidSearch.snapshotSearch.createSnapshotSearcherFromRegistry({
          snapshotId: snapshotId,
          snapshots: querySnapshotSvc.snapshots,
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
       * refreshRatedDocsForSearchApi() below (Query's "Show only rated" toggle), which otherwise
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

      function searchQuery(query) {
        return window.quepidSearch.queryService.searchQuery({
          query: query,
          createSearcher: function() {
            return svc.createSearcherFromSettings(currSettings, query);
          },
          createRatedSearcher: function() {
            return svc.createSearcherFromSettings(currSettings, query, { filterToRated: true });
          },
          setDocs: function(docs, numFound) {
            return query.setDocs(docs, numFound);
          },
          onError: function(message) {
            query.onError(message);
          },
          parseError: function(response, linkUrl) {
            return searchErrorTranslatorSvc.parseResponseObject(response, linkUrl, currSettings.searchEngine);
          },
          logDebug: function() {
            $log.debug.apply($log, arguments);
          },
          promiseApi: $q
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
              query.refreshRatedDocs();
            }
          });
        }
        publishQueryListState();
      }

      /**
       * An individual search query that gets executed.
       *
       * Per-query state: text, options, result documents, ratings store, search/snapshot runs, scoring,
       * and notes/options sync with the REST API for this query id.
       */
      let Query = function(queryWithRatings) {
        let self    = this;

        let qt      = 'query_text';
        let version = 1;

        self.hasBeenScored  = false;
        self.docsSet        = false;
        self.allRated       = true;
        self.ratingsPromise = null;
        self.ratingsGeneration = 0;
        self.ratingsReady   = false;

        self.queryId        = queryWithRatings.queryId;
        self.caseNo         = caseNo;
        self.queryText      = queryWithRatings[qt];
        self.ratings        = {};
        self.docs           = [];
        self.ratedDocs      = [];
        self.ratedDocsFound = 0;
        self.ratedDocsUnsupported  = false;
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

          return window.quepidSearch.queryScoring.scoreQuery({
            query: this,
            docs: otherDocs,
            ratingsStore: this.ratingsStore,
            scorer: this.effectiveScorer(),
            promiseApi: $q,
            depthOfRating: this.depthOfRating
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

              // Search/rating updates publish documents before scoring completes. Republish
              // here so read-model consumers (including the Frog Report) receive the current
              // missing-rating and all-rated state as soon as the score is available.
              publishQueryDocuments(that);

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
            if (angular.isFunction(doc.score)) {
              maxDocScore = Math.max(doc.score(), maxDocScore);
            }
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
          if (self.ratingsPromise) {
            return self.ratingsPromise;
          }

          var requestGeneration = self.ratingsGeneration;
          let settings = angular.copy(currSettings);

          if (pageSize) {
            settings.numberOfRows = pageSize;
          }

          if (settings.searchEngine === 'searchapi') {
            self.ratingsPromise = refreshRatedDocsForSearchApi(settings, requestGeneration).catch(function(error) {
              self.ratingsPromise = null;
              return $q.reject(error);
            });
            return self.ratingsPromise;
          }

          self.ratedSearcher = svc.createSearcherFromSettings(
              settings,
              self,
              { filterToRated: true }
            );

          let ratedDocsStaging = [];
          self.ratingsPromise = self.ratedSearcher.search().then(function() {
            if (requestGeneration !== self.ratingsGeneration) {
              self.ratingsPromise = null;
              return self.refreshRatedDocs(pageSize);
            }

            self.ratedUrl = self.ratedSearcher.linkUrl;

            let normed = normalizeDocExplains(self, self.ratedSearcher, currSettings.createFieldSpec());

            angular.forEach(normed, function(doc) {
              let rateableDoc = self.ratingsStore.createRateableDoc(doc);
              ratedDocsStaging.push(rateableDoc);
            });

            self.ratedDocs = ratedDocsStaging;
            self.ratedDocsFound = normed.length;
            self.ratingsReady = true;
            publishQueryDocuments(self);
            self.ratingsPromise = null;
          });
          var ratedDocsRequest = self.ratingsPromise;
          self.ratingsPromise = ratedDocsRequest.catch(function(error) {
            self.ratingsPromise = null;
            return $q.reject(error);
          });
          return self.ratingsPromise;
        };

        // filterToRatings() (createSearcherFromSettings' filterToRated option, above) has no
        // generic ID-filter syntax for a searchapi/mapper-based engine - unlike Solr's
        // {!terms f=id} or ES's terms query, there's no one query language to target across
        // arbitrary search APIs. Building the filter is also inherently async (mapper ->
        // settingsSvc.previewArgs), unlike the other engines' synchronous filterToRated
        // branches - svc.searchApiRatedDocs() is the shared pipeline for that, also used by
        // docFinder.js's initializeToRatedDocs() ("Already Rated Documents").
        //
        // An engine that hasn't opted in via mapperBasedSearchEngineSupportsRatedDocsLookup
        // (no ratedDocsQueryParamsMapper) can't support "Show only rated" at all - rather than
        // silently show unfiltered results mislabeled as "rated", self.ratedDocsUnsupported is
        // set so the UI can disable the control and say why (see core/_queries.html.erb).
        function refreshRatedDocsForSearchApi(settings, requestGeneration) {
          self.ratedDocsUnsupported = !svc.trySupportsSearchApiRatedDocsLookup(settings.selectedTry);

          if (self.ratedDocsUnsupported) {
            return resetRatedDocsToEmpty();
          }

          let ratedIDs = self.ratings ? Object.keys(self.ratings) : [];
          ratedIDs = ratedIDs.filter(function(id) { return id.length > 0; });

          if (ratedIDs.length === 0) {
            return resetRatedDocsToEmpty();
          }

          return svc.searchApiRatedDocs(settings, self, ratedIDs).then(function(result) {
            if (requestGeneration !== self.ratingsGeneration) {
              self.ratingsPromise = null;
              return self.refreshRatedDocs(settings.numberOfRows);
            }

            if (result === null) {
              self.ratedDocsUnsupported = true;
              return resetRatedDocsToEmpty();
            }

            self.ratedSearcher = result.searcher;
            self.ratedUrl = result.searcher.linkUrl;

            let ratedDocsStaging = [];
            angular.forEach(result.docs, function(doc) {
              ratedDocsStaging.push(self.ratingsStore.createRateableDoc(doc));
            });

            self.ratedDocs = ratedDocsStaging;
            // Vespa's own totalCount (unlike result.docs.length, a page's worth) covers every
            // rated doc the "in (...)" filter matched, not just this page - needed so the "peek
            // at next page" link knows there's more via ratedPaginate().
            self.ratedDocsFound = result.searcher.numFound;
            self.ratingsReady = true;
            publishQueryDocuments(self);
            self.ratingsPromise = null;
          });
        }

        // Shared "nothing to show" reset - used both when the engine can't look up rated docs
        // at all, and when it can but there simply are none yet (self.ratedDocsUnsupported is
        // left as whatever the caller already set, not touched here).
        function resetRatedDocsToEmpty() {
          self.ratedSearcher = null;
          self.ratedDocs = [];
          self.ratedDocsFound = 0;
          self.ratingsReady = true;
          publishQueryDocuments(self);
          self.ratingsPromise = null;
          return $q.resolve();
        }

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
            that.ratingsStore,
            matchFeaturesExplain
          );

          that.docs = docList.list();

          if (docList.hasErrors()) {
            error = docList.errorMsg();
            that.onError(docList.errorMsg());
          }

          that.docsSet = true;
          publishQueryDocuments(that);

          return error;
        };

        this.onError = function(errorText) {
          that.errorText = errorText;
          publishQueryDocuments(that);
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
          resultsReturned = false;
          return searchQuery(this);
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
                  let msg = self.searcher.searchError || 'Error loading snapshot results';
                  self.setDocs([], 0);
                  self.onError(msg);
                  reject(msg);
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

          // searchApiSearcherFactory.pager() (splainer-search) defers to
          // config.nextPageArgsMapper - set on the searcher by createSearcherFromSettings from
          // whatever the try's mapper_code defines (see nextPageArgsMapper in
          // db/mapper_based_search_engines/vespa.js) - and returns null the same way
          // Solr/ES/Algolia/Vectara's own pager() do when there's no mapper or no more pages.
          return window.quepidSearch.queryService.paginateQuery({
            searcher: self.searcher,
            pager: function(searcher) {
              self.searcher = searcher.pager();
              return self.searcher;
            },
            search: function(searcher) { return searcher.search(); },
            appendDocs: function(searcher) {
              let docList = new DocListFactory(
                searcher.docs,
                currSettings.createFieldSpec(),
                self.ratingsStore,
                matchFeaturesExplain
              );
              self.docs = self.docs.concat(docList.list());
              publishQueryDocuments(self);
            },
            logDebug: function() {
              $log.debug.apply($log, arguments);
            }
          });
        };

        this.ratedPaginate = function() {
            let self = this;

            if (self.ratedSearcher === null) {
              return;
            }

            // Same pager() as paginate() above - self.ratedSearcher already carries
            // config.nextPageArgsMapper from however it was built (refreshRatedDocsForSearchApi's
            // resolved rated-docs-filter args for searchapi, or the main query's args for
            // es/os/solr/vectara/algolia), so it bumps whichever args it already has.
            self.ratedSearcher = self.ratedSearcher.pager();

            if (self.ratedSearcher === null) {
              return;
            }

            return self.ratedSearcher.search()
              .then(function() {
                let normed = svc.normalizeDocExplains(self, self.ratedSearcher, currSettings.createFieldSpec());
                self.ratedDocs = self.ratedDocs.concat(normed);
                publishQueryDocuments(self);
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
            })
            .catch(function(response) {
              // Re-reject rather than returning: returning a value from a rejection handler
              // RESOLVES the promise, which made the query-notes controller run its success path on a failed
              // save -- flashing "saved", collapsing the panel and discarding the user's edits.
              $log.debug('Failed to save notes: ', response);
              return $q.reject(response);
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

        this.reset = function() {
          this.errorText = '';
          resultsReturned = false;
          this.docs.length = 0;
        };

        this.state = function() {
          return window.quepidSearch.queryState.queryLifecycleState({
            errorText: this.errorText,
            resultsReturned: resultsReturned,
            docCount: this.docs.length
          });
        };

        this.searchAndScore = function() {
          return this.search().then( () => {
            return this.score();
          }).then( () => {
            // Sync query results to associated Book if one exists
            svc.syncToBook();
          });
        };

        // Per-engine filter syntax lives in app/javascript/utils/rated_docs.js (Vitest-covered).
        this.filterToRatings = function(settings, slice) {
          return window.quepidSearch.ratedDocs.buildFilter({
            searchEngine: settings.searchEngine,
            idField:      settings.createFieldSpec().id,
            ratedIds:     window.quepidSearch.ratedDocs.ids(self.ratings, slice, settings.numberOfRows)
          });
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
        if (queryCollectionStore && queryCollectionStore.status !== 'idle') {
          return queryCollectionStore.size;
        }
        return Object.keys(this.queries).length;
      };

      let that = this;
      let addQueriesFromResp = function(data, collectionCaseId) {
        // Update the display order
        svcVersion++;
        that.displayOrder = data.display_order;

        // Parse query array
        let newQueries = [];
        let querySnapshots = [];
        angular.forEach(data.queries, function(queryWithRatings) {
          if (!(Object.prototype.hasOwnProperty.call(queryWithRatings, 'deleted') &&
                queryWithRatings.deleted === 'true')) {
            let newQueryId = queryWithRatings.query_id;
            queryWithRatings.queryId = queryWithRatings.query_id;
            let newQuery = new Query(queryWithRatings);
            that.queries[newQueryId] = newQuery;
            newQueries.push(newQueryId);
            querySnapshots.push(queryWithRatings);
            window.quepidSearch.diff.createQueryDiff({
              query: newQuery,
              diffSettings: queryViewSvc.getAllDiffSettings(),
              settings: settingsSvc.editableSettings(),
              createSearcherFromSnapshot: createSearcherFromSnapshot
            });
          }
        });

        if (queryCollectionStore) {
          queryCollectionStore.replaceFromResponse(
            collectionCaseId === undefined ? caseNo : collectionCaseId,
            data
          );
        }

        return newQueries;
      };

      let querySearchableDeferred = $q.defer();
      let bootstrapGeneration = 0;
      function bootstrapQueries(caseNo) {
        var generation = ++bootstrapGeneration;
        svc.isBootstrapping = true;
        publishQueryListState();
        if (queryCollectionStore) {
          queryCollectionStore.beginBootstrap(caseNo);
        }
        var searchableDeferred = $q.defer();
        querySearchableDeferred = searchableDeferred;
        var request = window.quepidSearch.queryLifecycle.bootstrapRequest(caseNo);

        $http(request)
          .then(function(response) {
            if (generation !== bootstrapGeneration) {
              searchableDeferred.reject({ status: 0, statusText: 'Stale bootstrap request' });
              return response;
            }
            that.queries = {};
            addQueriesFromResp(response.data, caseNo);

            svc.isBootstrapping = false;
            publishQueryListState();
            searchableDeferred.resolve();
          }, function(response) {
            if (generation !== bootstrapGeneration) {
              searchableDeferred.reject({ status: 0, statusText: 'Stale bootstrap request' });
              return response;
            }
            $log.debug('Failed to bootstrap queries: ', response);
            svc.isBootstrapping = false;
            publishQueryListState();
            if (queryCollectionStore) {
              queryCollectionStore.markError(response);
            }
            searchableDeferred.reject(response);
            return response;
          }).catch(function(response) {
            if (generation !== bootstrapGeneration) {
              return response;
            }
            $log.debug('Failed to bootstrap queries');
            svc.isBootstrapping = false;
            publishQueryListState();
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
        window.quepidSearch.queryLifecycle.caseId = newCaseNo;

        if (caseNo !== newCaseNo) {
          // Clear sync cache when switching cases
          syncedPairsCache = {};
          scorerSvc.bootstrap(newCaseNo);
          bootstrapQueries(newCaseNo);

          // Fetch case data to initialize book sync properties
          $http.get('api/cases/' + newCaseNo).then(function(response) {
            cachedBookId = response.data.book_id;
            cachedAutoPopulateBookPairs = response.data.auto_populate_book_pairs;
          });
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

      // Process a queue of async functions with optional rate limiting
      // - No rate limit (null/0): runs up to 10 concurrent requests
      // - With rate limit: runs sequentially with delays between requests
      this.pAll = window.quepidSearch.queryService.pAll;

      this.searchAll = function() {
        let searchAllPromise = window.quepidSearch.queryService.runSearchAll({
          queries: this.queries,
          search: function(query) {
            return query.search();
          },
          score: function(query) {
            return query.score();
          },
          requestsPerMinute: currSettings.selectedTry.requestsPerMinute,
          scoreAll: function() {
            /*
             * Keep per-query score() separate from scoreAll(): the former drives
             * progress, while the latter calculates the case aggregate.
             */
            return svc.scoreAll();
          },
          syncToBook: function() {
            svc.syncToBook();
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
        searchAllPromise.catch(angular.noop);
        return searchAllPromise;
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
        window.quepidSearch.diff.createQueryDiff({
          query: newQuery,
          diffSettings: queryViewSvc.getAllDiffSettings(),
          settings: settingsSvc.editableSettings(),
          createSearcherFromSnapshot: createSearcherFromSnapshot
        });
        return newQuery;
      };

      function prepareQueries(queryTexts) {
        if (queryTexts.length === 1) {
          return { query: svc.createQuery(queryTexts[0]) };
        }

        return { queries: queryTexts.map(function(queryText) {
          return svc.createQuery(queryText);
        }) };
      }

      function commitSingleQuery(query, persisted) {
        if (persisted.status !== 204) {
          svc.displayOrder = persisted.data.display_order;
          query.queryId = persisted.data.query.query_id;
          query.ratingsStore.setQueryId(query.queryId);
          svc.queries[query.queryId] = query;
          if (queryCollectionStore) {
            queryCollectionStore.setDisplayOrder(svc.displayOrder);
            queryCollectionStore.upsert(query);
          }
          svcVersion++;
        }

        return query.searchAndScore().then(function() {
          $log.info('rescoring queries after adding query');
          svc.updateScores();
          return {};
        }, function(searchError) {
          return { searchError: searchError };
        });
      }

      function commitBulkQueries(persisted) {
        svc.queries = {};
        addQueriesFromResp(persisted.data, caseNo);

        return svc.searchAll().then(function() {
          return {};
        }, function(searchError) {
          return { searchError: searchError };
        });
      }

      // The setup wizard historically persisted its bulk queries without
      // searching them. Keep that behavior while moving the HTTP request out
      // of this service; the live query/search migration will own this state
      // commit later.
      function commitPersistedQueries(persisted) {
        svc.queries = {};
        addQueriesFromResp(persisted.data, caseNo);
        return {};
      }

      function commitQueries(prepared, persisted) {
        if (prepared.query) {
          return commitSingleQuery(prepared.query, persisted);
        }

        return commitBulkQueries(persisted);
      }

      // get the full list of queries sorted by create/manual order
      // only call this when our version() changes
      this.queryArray = function() {
        if (queryCollectionStore && queryCollectionStore.status === 'ready') {
          // Keep the legacy defaultCaseOrder contract while taking the order
          // itself from the store. Angular's existing orderBy and any other
          // consumers still rely on this field being refreshed on each read.
          return window.quepidSearch.queryState.orderedQueries(
            queryCollectionStore.orderedQueryIds(),
            this.queries
          );
        }
        return window.quepidSearch.queryState.orderedQueries(this.displayOrder, this.queries);
      };

      this.updateQueryDisplayPosition = function(queryId, oldQueryId, reverse) {
        var request = window.quepidSearch.queryLifecycle.positionRequest(
          caseNo,
          queryId,
          oldQueryId,
          reverse
        );

        return $http(request)
          .then(function(response) {
            svc.displayOrder = response.data.display_order;
            if (queryCollectionStore) {
              queryCollectionStore.setDisplayOrder(svc.displayOrder);
            }
            svcVersion++;
          }, function() {
            svcVersion++;
          }).catch(function(response) {
            $log.debug('Failed to update query display position');
            return response;
          });
      };

      // Temporary adapter for the Stimulus reorder controller. The controller
      // owns the PUT; Angular keeps the live display order in sync until the
      // query store becomes authoritative.
      this.applyDisplayOrder = function(displayOrder) {
        svc.displayOrder = displayOrder;
        if (queryCollectionStore) {
          queryCollectionStore.setDisplayOrder(displayOrder);
        }
        svcVersion++;
      };

      // Delete a query
      this.deleteQuery = function(queryId) {
        var that = this;

        return $http(window.quepidSearch.queryLifecycle.deleteRequest(caseNo, queryId))
          .then(function() {
            delete that.queries[queryId];
            if (queryCollectionStore) {
              queryCollectionStore.remove(queryId);
            }
            if (queryDocumentsStore) {
              queryDocumentsStore.removeQuery(queryId);
            }
            svcVersion++;
          })
          .catch(function(response) {
            // Re-reject so a failed delete cannot look like a success to the caller.
            $log.debug('Failed to delete query: ', response);
            return $q.reject(response);
          });
      };

      // Move a query
      this.moveQuery = function(query, targetCase) {
        var that = svc;
        return $http(window.quepidSearch.queryLifecycle.moveRequest(query, targetCase.caseNo))
          .then(function() {
            delete that.queries[query.queryId];
            if (queryCollectionStore) {
              queryCollectionStore.remove(query.queryId);
            }
            if (queryDocumentsStore) {
              queryDocumentsStore.removeQuery(query.queryId);
            }
            svcVersion++;
          })
          .catch(function(response) {
            // Re-reject so the Stimulus Move Query controller can show its error state.
            $log.debug('Failed to move query: ', response);
            return $q.reject(response);
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
        // Aggregation math (sentinel exclusion + averaging) lives in
        // app/javascript/utils/scoring.js (Vitest-covered).
        let isFullScoreAll = (scorables === undefined);
        if (scorables === undefined) {
          scorables = this.queries;
        }
        return window.quepidSearch.queryScoring.scoreAllQueries({
          scorableCollection: scorables,
          promiseApi: $q,
          logger: console
        }).then(function(scoreInfo) {
          svc.latestScoreInfo = scoreInfo;

          // Dual-run shadow store (docs/todo/angularjs_removal_inventory.md §
          // Re-render mechanism, step 3). Pure side effect — does not affect
          // Angular's own rendering, which still reads svc.latestScoreInfo via
          // avgQuery.currentScore / the retired Angular query-list watch group.
          //
          // Only mirror a full-case scoreAll() — the store replaces its whole
          // query-score set on every write (by design, see
          // case_score_store.test.js), so a partial-scorables call here (e.g.
          // scoreAllDiffs() scoring just the diffed queries) would wipe every
          // other query's entry and blank out the Stimulus badges that read
          // from it (qscore_query_controller.js, query_unrated_badge_controller.js).
          if (isFullScoreAll) {
            window.quepidStore.scoring.setLatestScoreInfo(svc.latestScoreInfo);
          }

          publishQueryListState();

          return svc.latestScoreInfo;
        });
      };

      // Refresh diff objects for all queries after state changes
      this.refreshAllDiffs = function() {
        var refreshes = [];
        angular.forEach(this.queries, function(query) {
          refreshes.push(window.quepidSearch.diff.createQueryDiff({
            query: query,
            diffSettings: queryViewSvc.getAllDiffSettings(),
            settings: settingsSvc.editableSettings(),
            createSearcherFromSnapshot: createSearcherFromSnapshot
          }));
          // Publish the initialized snapshot documents immediately. Score
          // values are refreshed asynchronously below, but the Stimulus
          // renderer should not wait for every query's scoring promise before
          // it can show the comparison columns.
          publishQueryDocuments(query);
        });
        return $q.all(refreshes).then(function() {
          angular.forEach(svc.queries, publishQueryDocuments);
          document.dispatchEvent(new CustomEvent('query-diffs:refreshed', {
            detail: { success: true }
          }));
        }, function(error) {
          document.dispatchEvent(new CustomEvent('query-diffs:refreshed', {
            detail: { success: false }
          }));
          return $q.reject(error);
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

      this.syncToBook = function() {
        // Only sync if we have a case with a book associated
        if (!caseNo || caseNo === -1) {
          return;
        }

        if (!cachedBookId) {
          return; // No book associated with this case
        }

        if (!cachedAutoPopulateBookPairs) {
          return; // Auto-populate of book query/doc pairs is disabled for this case
        }

        var bookId = cachedBookId;

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
      };

      /*jslint latedef:false*/
      function getCaseNo(){
        return caseNo;
      }
    }
  ]);
