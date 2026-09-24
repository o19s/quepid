'use strict';
/*jslint latedef:false*/

/**
 * Primary controller for the queries list and aggregate row: wires `queriesSvc` to the template,
 * handles modals (snapshots, annotations, etc.), listens for scoring and rating events to refresh
 * averages and diffs, and coordinates sort/order when enabled.
 */

angular.module('QuepidApp')
  .controller('QueriesCtrl', [
    '$scope',
    '$element',
    '$q',
    '$log',
    '$location',
    'queriesSvc',
    'queryViewSvc',
    'querySnapshotSvc',
    'caseSvc',
    'scorerSvc',
    'configurationSvc',
    'qscoreSvc',
    'settingsSvc',
    function (
      $scope,
      $element,
      $q,
      $log,
      $location,
      queriesSvc,
      queryViewSvc,
      querySnapshotSvc,
      caseSvc,
      scorerSvc,
      configurationSvc,
      qscoreSvc,
      settingsSvc,
    ) {
      console.log('QueriesCtrl instantiated');
      $scope.queriesSvc = queriesSvc;
      $scope.caseSvc = caseSvc;
      $scope.queryListSortable = configurationSvc.isQueryListSortable();

      $element.on('queries-list:toggle-rated', function () {
        $scope.$evalAsync(function () {
          if (!$scope.showOnlyRatedUnsupported()) {
            queriesSvc.toggleShowOnlyRated();
          }
        });
      });
      $element.on('queries-list:collapse-all', function () {
        $scope.$evalAsync($scope.collapseAll);
      });
      $element.on('queries-list:sort', function (event) {
        $scope.$evalAsync(function () {
          var originalEvent = event.originalEvent || {};
          var field = (originalEvent.detail && originalEvent.detail.field) ||
            (event.detail && event.detail.field);
          $scope.sortBy(field);
        });
      });
      $element.on('queries-list:filter', function (event) {
        $scope.$evalAsync(function () {
          var originalEvent = event.originalEvent || {};
          var originalValue = originalEvent.detail && originalEvent.detail.value;
          var value = originalValue !== undefined && originalValue !== null ?
            originalValue :
            (event.detail && event.detail.value);
          $scope.queryFilter = value !== undefined && value !== null ? value : '';
        });
      });
      $element.on('queries-list:position-saved', function (event) {
        $scope.$evalAsync(function () {
          var originalEvent = event.originalEvent || {};
          var detail = originalEvent.detail || event.detail || {};
          if (detail.displayOrder) {
            queriesSvc.applyDisplayOrder(detail.displayOrder);
          }
        });
      });
      $scope.$on('$destroy', function () { $element.off('queries-list:toggle-rated queries-list:collapse-all queries-list:sort queries-list:filter queries-list:position-saved'); });
      // The scoringCompleteListener is a workaround for the fact that
      // we create multiple instances of this controller when we reselect the
      // same Case in the core app.  Which leads to multiple calls to the backend for the same scoring complete calculation
      // performed by .calcScore() call.
      const scoringCompleteHandler = () => {
        $scope.$evalAsync(() => {
          $scope.queries.avgQuery.calcScore();

          // Also recalculate case-level diff scores if diffs are enabled
          if ($scope.queries.avgQuery.diffs) {
            $scope.queries.avgQuery.diffs.calculateCaseScores();
          }
        });
      };
      
      // Debounced case score recalculation to prevent multiple rapid updates
      var caseScoreUpdateTimeout;
      
      // Listen for rating changes to update case scores immediately
      const ratingChangedHandler = () => {
        $scope.$evalAsync(() => {
        // Debounce to prevent multiple rapid recalculations
        if (caseScoreUpdateTimeout) {
          clearTimeout(caseScoreUpdateTimeout);
        }
        
        caseScoreUpdateTimeout = setTimeout(() => {
          // When ratings change, refresh individual query diff scores first
          if ($scope.queries.avgQuery.diffs) {
            // Refresh all individual query diffs to get updated scores
            var refreshPromises = [];
            angular.forEach(queriesSvc.queries, function(query) {
              if (query.diffs && query.diffs.fetch) {
                refreshPromises.push(query.diffs.fetch());
              }
            });
            
            // Then recalculate case-level scores based on updated diff scores
            $q.all(refreshPromises).then(function() {
              $scope.queries.avgQuery.diffs.calculateCaseScores();
            });
          }
          caseScoreUpdateTimeout = null;
        }, 100); // 100ms debounce
        });
      };

      const scoringStore = window.quepidStore && window.quepidStore.scoring;
      if (scoringStore) {
        scoringStore.addEventListener('scoring-complete', scoringCompleteHandler);
        scoringStore.addEventListener('rating-changed', ratingChangedHandler);
      }
      
      $scope.$on('$destroy', () => {
        if (scoringStore) {
          scoringStore.removeEventListener('scoring-complete', scoringCompleteHandler);
          scoringStore.removeEventListener('rating-changed', ratingChangedHandler);
        }
        if (caseScoreUpdateTimeout) {
          clearTimeout(caseScoreUpdateTimeout); // Clean up timeout
        }
      });
      $scope.queries = {};

      $scope.sortBy                   = sortBy;
      $scope.getScorer                = getScorer;
      $scope.canAddQueries            = canAddQueries;
      $scope.addQueryMessage          = addQueryMessage;

      // Snapshot modal trigger attrs — live try settings for the Stimulus take-snapshot modal.
      $scope.snapshotFieldSpec = function() {
        if (!settingsSvc.isTrySelected()) { return ''; }
        return settingsSvc.applicableSettings().fieldSpec || '';
      };
      $scope.snapshotSearchEngine = function() {
        if (!settingsSvc.isTrySelected()) { return ''; }
        return settingsSvc.applicableSettings().searchEngine || '';
      };
      $scope.snapshotMapperEngineName = function() {
        if (!settingsSvc.isTrySelected()) { return ''; }
        return settingsSvc.applicableSettings().mapperBasedSearchEngineName || '';
      };

      $scope.reverse = $location.search().reverse;
      $scope.sortBy($location.search().sort || 'default', !$scope.reverse);

      function canAddQueries() {
        return !(settingsSvc.isTrySelected() && settingsSvc.applicableSettings().searchEngine === 'static');
      }

      function addQueryMessage() {
        return canAddQueries() ? 'Add a query to this case' : 'Adding queries is not supported';
      }

      var runScore = function(resultObject) {
        if ( resultObject === undefined ) {
          resultObject = {};
        }

        // This triggers a refresh in qscore
        resultObject.currentScore = queriesSvc.latestScoreInfo;

        resultObject.lastScore    = resultObject.currentScore.score;
        lastVersion               = queriesSvc.version();

        if (
          angular.isNumber(resultObject.lastScore) &&
          resultObject.lastScore !== -1
        ) {
          var scoreInfo = resultObject.currentScore;

          // TODO: This seems bugged, maybe force specification of max score?
          // Fetch the potential total max score by averaging
          // the max score of each query,
          // the same way we average the score of each query
          // to get the case score.
          var maxScores = Object.keys(scoreInfo.queries)
            .map(function(key) {
              var item = scoreInfo.queries[key];
              return item.maxScore;
            }).filter(function(i) {
              return i !== null && i !== undefined;
            });

          $scope.maxScore = maxScores.
            reduce(function(a, b) { return a + b; }, 0) / maxScores.length;
          if (!isNaN($scope.maxScore)) {
            $scope.maxScore = Math.max(1, $scope.maxScore);
          }
        }
      };

      // a simulated "query" that the results view uses for display
      var lastVersion = -1;
      var avgQuery = {
        caseLevelQuery: true,
        lastScore: -1,
        calcScore: function() {
          // rescore only if
          // - there are no unscored queries
          // - we seem to have a new version of the query service
          if (!queriesSvc.hasUnscoredQueries() &&
              (lastVersion !== queriesSvc.version())) {

            runScore(this);
            saveScoring();
          }
        },
        diffs: null
      };



      var diffGeneration = 0;

      // Watch for any diff changes and trigger case-level diff scoring
      $scope.$watchCollection(function() {
        return queryViewSvc.getAllDiffSettings();
      }, function() {
        var generation = ++diffGeneration;
        var isEnabled = queryViewSvc.isAnyDiffEnabled();
        if (isEnabled) {
          // Create case-level diffs object similar to individual query diffs
          var diffModel = {
            _caseSearchers: [],
            getSearchers: function() {
              return this._caseSearchers;
            },
            fetch: function() {
              // Wait for all individual query diffs to be fetched first
              var fetchPromises = [];
              if (queriesSvc.queries && Array.isArray(queriesSvc.queries)) {
                angular.forEach(queriesSvc.queries, function(query) {
                  if (query.diffs !== null) {
                    fetchPromises.push(query.diffs.fetch());
                  }
                });
              } else {
                // Handle queries as object
                for (var key in queriesSvc.queries) {
                  var query = queriesSvc.queries[key];
                  if (query && query.diffs !== null) {
                    fetchPromises.push(query.diffs.fetch());
                  }
                }
              }
              
              return $q.all(fetchPromises).then(function() {
                if (generation !== diffGeneration || $scope.queries.avgQuery.diffs !== diffModel) {
                  return;
                }

                // After all individual query scores are calculated, compute case-level scores
                return diffModel.calculateCaseScores();
              }).catch(function() {
                if (generation !== diffGeneration || $scope.queries.avgQuery.diffs !== diffModel) {
                  return;
                }

                // Case-level diff scoring error - silently handled. Clear the
                // Stimulus read model too, so failed refreshes cannot leave
                // badges from the previous comparison visible.
                if (window.quepidStore && window.quepidStore.documents) {
                  window.quepidStore.documents.clearCaseDiffs();
                }
              });
            },
            calculateCaseScores: function() {
              var self = this;
              
              // Get searchers from the first query's diffs to determine structure
              var firstQuery = null;
              if (queriesSvc.queries && Array.isArray(queriesSvc.queries)) {
                firstQuery = queriesSvc.queries.find(function(q) {
                  return q.diffs && q.diffs.getSearchers;
                });
              } else {
                // Handle queries as object
                for (var key in queriesSvc.queries) {
                  var query = queriesSvc.queries[key];
                  if (query && query.diffs && query.diffs.getSearchers) {
                    firstQuery = query;
                    break;
                  }
                }
              }
              
              if (!firstQuery) {
                self._caseSearchers = [];
                if (window.quepidStore && window.quepidStore.documents) {
                  window.quepidStore.documents.clearCaseDiffs();
                }
                return $q.resolve();
              }
              
              var templateSearchers = firstQuery.diffs.getSearchers();
              self._caseSearchers = [];
              
              // For each searcher position, create a case-level searcher with averaged scores
              angular.forEach(templateSearchers, function(templateSearcher, searcherIndex) {
                var caseSearcher = {
                  name: function() { return templateSearcher.name(); },
                  version: function() { return templateSearcher.version(); },
                  diffScore: { score: '?', allRated: false },
                  currentScore: null // Will be set as getter below
                };
                
                // Add currentScore getter for qscore component compatibility
                Object.defineProperty(caseSearcher, 'currentScore', {
                  get: function() {
                    return this.diffScore;
                  },
                  enumerable: true,
                  configurable: true
                });
                
                // Calculate average score across all queries for this searcher
                var totalScore = 0;
                var validScores = 0;
                var allRated = true;
                
                // Collect scores from all queries for this searcher index
                if (queriesSvc.queries && Array.isArray(queriesSvc.queries)) {
                  angular.forEach(queriesSvc.queries, function(query) {
                    if (query.diffs && query.diffs.getSearcher) {
                      var querySearcher = query.diffs.getSearcher(searcherIndex);
                      if (querySearcher && querySearcher.diffScore) {
                        var score = querySearcher.diffScore.score;
                        if (score !== null && score !== undefined && score !== 'zsr' && score !== '--') {
                          totalScore += score;
                          validScores++;
                        }
                        if (!querySearcher.diffScore.allRated) {
                          allRated = false;
                        }
                      }
                    }
                  });
                } else if (queriesSvc.queries && typeof queriesSvc.queries === 'object') {
                  for (var key in queriesSvc.queries) {
                    var query = queriesSvc.queries[key];
                    if (query && query.diffs && query.diffs.getSearcher) {
                      var querySearcher = query.diffs.getSearcher(searcherIndex);
                      if (querySearcher && querySearcher.diffScore) {
                        var score = querySearcher.diffScore.score;
                        if (score !== null && score !== undefined && score !== 'zsr' && score !== '--') {
                          totalScore += score;
                          validScores++;
                        }
                        if (!querySearcher.diffScore.allRated) {
                          allRated = false;
                        }
                      }
                    }
                  }
                }
                
                // Calculate final average score
                if (validScores > 0) {
                  caseSearcher.diffScore.score = totalScore / validScores;
                  // Add backgroundColor using qscoreSvc for proper color coding
                  if ($scope.maxScore && $scope.maxScore > 0) {
                    caseSearcher.diffScore.backgroundColor = qscoreSvc.scoreToColor(caseSearcher.diffScore.score, $scope.maxScore);
                  }
                } else {
                  caseSearcher.diffScore.score = '--';
                  caseSearcher.diffScore.backgroundColor = qscoreSvc.scoreToColor('--', $scope.maxScore || 1);
                }
                caseSearcher.diffScore.allRated = allRated;
                
                self._caseSearchers.push(caseSearcher);
              });

              // The comparison header is Stimulus-owned. Publish the same
              // case-level read model that qscore-case used to render from
              // Angular scope, while Angular retains the live scoring engine.
              if (window.quepidStore && window.quepidStore.documents) {
                window.quepidStore.documents.setCaseDiffs(self._caseSearchers.map(function(searcher) {
                  return {
                    name: searcher.name(),
                    version: searcher.version(),
                    score: Object.assign({}, searcher.diffScore, {
                      maxScore: $scope.maxScore || 1
                    })
                  };
                }));
              }
              
              return $q.resolve();
            }
          };

          $scope.queries.avgQuery.diffs = diffModel;
          
          // Initialize the diffs
          diffModel.fetch();
        } else {
          $scope.queries.avgQuery.diffs = null;
          if (window.quepidStore && window.quepidStore.documents) {
            window.quepidStore.documents.clearCaseDiffs();
          }
        }
      });

      $scope.queries.queriesChanged = function() {
        return queriesSvc.version();
      };

      function saveScoring() {
        // finished a batch run, log the result!
        var caseNo  = configurationSvc.getCaseNo();
        var tryNo   = configurationSvc.getTryNo();
        
        if (Object.keys($scope.queries.avgQuery.currentScore.queries).length === 0) {
          // if we have no queries, then let's short circuit this.  We don't need to
          // record scores for cases with zero queries.
          return;
        }

        if ( isNaN(tryNo) ) {  // If we didn't specify a try, then we need to get the latest
          caseSvc.get(caseNo)
            .then(function(acase) {
              if (angular.isUndefined(acase)){
                $log.info('Did not find a case for ' + caseNo + ' and therefore not scoring');
              }
              else {
                tryNo = acase.lastTry;
              
                $log.info('We do not have a tryNo, so we grabbed the lastTry from the case, and using it as the id:' + tryNo);
                lastScoreTracker = {
                  'score':      $scope.queries.avgQuery.currentScore.score,
                  'all_rated':  $scope.queries.avgQuery.currentScore.allRated,
                  'try_number': tryNo,
                  'queries':    $scope.queries.avgQuery.currentScore.queries,
                };
  
                $log.info('sending score information to mothership');
                caseSvc.trackLastScore(caseNo, lastScoreTracker);
              }
            });
        }
        else {
          var lastScoreTracker = {
            'score':      $scope.queries.avgQuery.currentScore.score,
            'all_rated':  $scope.queries.avgQuery.currentScore.allRated,
            'try_number': tryNo,
            'queries':    $scope.queries.avgQuery.currentScore.queries,
          };

          $log.info('sending score information to mothership');
          caseSvc.trackLastScore(caseNo, lastScoreTracker);
        }
      }

      $scope.queries.avgQuery = avgQuery;

      // get all the queries for this case for the query service
      $scope.queriesList = [];
      $scope.$watch(function(){
        // only call if the query service has new information!
        return queriesSvc.version();
      }, function(){
        $scope.queriesList = queriesSvc.queryArray();
        updateBatchInfo();
      });

      $scope.searching = function() {
        return queriesSvc.hasUnscoredQueries();
      };
      $scope.isBootstrapping = function() {
        return queriesSvc.isBootstrapping;
      };
      $scope.batchPosition = 0;
      $scope.batchSize = 0;
      function getBatchPosition() {
        return queriesSvc.scoredQueryCount();
      }

      function updateBatchInfo() {
        $scope.batchSize = queriesSvc.queryCount();
        $scope.batchPosition = queriesSvc.scoredQueryCount();
      }
      $scope.$watch(getBatchPosition, updateBatchInfo);

      $scope.pagination = {
        currentPage: 1,
        pageSize: 15
      };

      $scope.queries.sortingEnabled = false;
      $scope.queries.isSortingEnabled = function () {
        return $scope.queries.sortingEnabled;
      };
      $scope.queries.toggleSorting = function() {
        $scope.queries.sortingEnabled = !$scope.queries.sortingEnabled;
      };

      $scope.collapseAll = function() {
        queryViewSvc.collapseAll();
        if (window.quepidStore && window.quepidStore.documents) {
          window.quepidStore.documents.collapseAll();
        }
      };

      // Delegates to queriesSvc.trySupportsRatedDocsLookup(), the single source of truth also
      // used by docFinder.js's "Already Rated Documents" section - keeping both gates on the
      // same function is what keeps them in sync. (This file previously kept its own copy of
      // the engine list, which drifted: algolia's filterToRated branch in queriesSvc.js is a
      // no-op, but this gate didn't know that, so the checkbox stayed enabled and toggling it
      // silently filtered nothing while the results counter still switched to the rated-doc
      // count - looking like it worked when it didn't.)
      $scope.showOnlyRatedUnsupported = function() {
        if (!settingsSvc.isTrySelected()) {
          return false;
        }

        var aTry = settingsSvc.applicableSettings();
        return !queriesSvc.trySupportsRatedDocsLookup(aTry);
      };

      function getScorer() {
        return scorerSvc.defaultScorer;
      }

      function sortBy(field, skipOrder) {
        if (typeof field === 'string') {
          if (!skipOrder) {
            switchSortOrder(field, $scope.sortName);
          }
          $scope.sortName = field;
          $location.search('sort', field);
          switch (field) {
            case 'default':
              $scope.sort = 'defaultCaseOrder';
              $scope.sortName = 'default';
              break;
            case 'modified':
              $scope.sort = '-modifiedAt';
              $scope.sortName = 'modified';
              break;
            case 'query':
              $scope.sort = 'queryText';
              $scope.sortName = 'query';
              break;
            case 'score':
              $scope.sort = '-lastScore';
              $scope.sortName = 'score';
              break;
            case 'error':
              $scope.sort = ['-errorText', 'allRated'];
              $scope.sortName = 'error';
              break;
          }
        }

      }

      function switchSortOrder(field, lastField) {
        if (field === lastField) {
          $scope.reverse = !$scope.reverse;
        } else {
          $scope.reverse = false;
        }
        $location.search('reverse', $scope.reverse);
      }

      $scope.matchQueryFilter = function(query) {
        return window.quepidSearch.queryState.matchesQueryFilter(query, $scope.queryFilter);
      };

    }
  ]);
