'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('QueriesCtrl', [
    '$scope',
    '$rootScope',
    '$q',
    '$log',
    '$location',
    '$routeParams',
    '$uibModal',
    'queriesSvc',
    'queryViewSvc',
    'querySnapshotSvc',
    'caseSvc',
    'scorerSvc',
    'configurationSvc',
    'annotationsSvc',
    'qscoreSvc',
    function (
      $scope,
      $rootScope,
      $q,
      $log,
      $location,
      $routeParams,
      $uibModal,
      queriesSvc,
      queryViewSvc,
      querySnapshotSvc,
      caseSvc,
      scorerSvc,
      configurationSvc,
      annotationsSvc,
      qscoreSvc,
    ) {
      console.log('QueriesCtrl instantiated');
      $scope.queriesSvc = queriesSvc;
      $scope.caseSvc = caseSvc;
      $scope.queryListSortable = configurationSvc.isQueryListSortable();
      $scope.annotations = []; // Initialize annotations array

      // The scoringCompleteListener is a workaround for the fact that
      // we create multiple instances of this controller when we reselect the
      // same Case in the core app.  Which leads to multiple calls to the backend for the same scoring complete calculation
      // performed by .calcScore() call.
      const scoringCompleteListener = $rootScope.$on('scoring-complete', () => {
        $scope.queries.avgQuery.calcScore();
        
        // Also recalculate case-level diff scores if diffs are enabled
        if ($scope.queries.avgQuery.diffs) {
          $scope.queries.avgQuery.diffs.calculateCaseScores();
        }
      });
      
      // Debounced case score recalculation to prevent multiple rapid updates
      var caseScoreUpdateTimeout;
      
      // Listen for rating changes to update case scores immediately
      const ratingChangedListener = $rootScope.$on('rating-changed', () => {
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
      
      $scope.$on('$destroy', () => {
        scoringCompleteListener(); // Deregister the listener
        ratingChangedListener(); // Deregister the listener
        if (caseScoreUpdateTimeout) {
          clearTimeout(caseScoreUpdateTimeout); // Clean up timeout
        }
      });
      // $rootScope.$on('scoring-complete', () => {
      //   $scope.queries.avgQuery.calcScore();
      // });

      // Options for ui-sortable at http://api.jqueryui.com/sortable/
      var sortableOptions = {
        opacity:        0.75,
        revert:         250,
        helper:         'clone',
        axis:           'y',
        cancel:         '.unsortable',
        start: function() {
          $scope.$apply($scope.dragging = true);

          // This is required because by the time the `stop` function is called
          // the list is already altered by the directive, so the items are
          // already in the new order.
          $scope.originalList = angular.copy($scope.queriesList);

          if ( $scope.reverse ) {
            $scope.originalList = $scope.originalList.reverse();
          }
        },
        stop: function(event, ui) {
          if (ui.item.sortable.droptarget === undefined) {
            $scope.$apply($scope.dragging = false);
            return;
          }

          var reverse   = $scope.reverse;
          var fromIndex = ui.item.sortable.index;
          var toIndex   = ui.item.sortable.dropindex;
          fromIndex     = fromIndex + (
            ($scope.pagination.currentPage - 1) * $scope.pagination.pageSize
          );
          toIndex       = toIndex + (
            ($scope.pagination.currentPage - 1) * $scope.pagination.pageSize
          );

          var item      = $scope.originalList[fromIndex];
          var oldItem   = $scope.originalList[toIndex];

          if (toIndex < fromIndex) {
            reverse = !reverse;
          }

          if ( !angular.isUndefined(toIndex) && fromIndex !== toIndex ) {
            queriesSvc.updateQueryDisplayPosition(item.queryId, oldItem.queryId, reverse)
              .then(function() {
                $scope.originalList = $scope.queriesList;
              });
          }

          $scope.$apply($scope.dragging = false);
        }
      };

      $scope.queries                  = {};
      $scope.queries.sortableOptions  = sortableOptions;

      $scope.pickCaseScorer           = pickCaseScorer;
      $scope.sortBy                   = sortBy;

      $scope.getScorer                = getScorer;

      $scope.reverse = $location.search().reverse;
      $scope.sortBy($location.search().sort || 'default', !$scope.reverse);


      // We continue to get multiple of these events, once each time the controller gets
      // created by picking the case in the drop down.  
      $scope.$on('updatedCaseScore', function(event, theCase) {
        //event.stopPropagation(); // we are somehow duplicating this event.
        if (theCase.caseNo === caseSvc.getSelectedCase().caseNo) {
          caseSvc.getSelectedCase()
            .fetchCaseScores()
            .then(function(returnedCase) {
              $scope.scores = returnedCase.scores;
            });

          // Also re-fetch annotations
          annotationsSvc.fetchAll(theCase.caseNo)
            .then(function(annotations) {
              console.log('Fetched annotations:', annotations);
              $scope.annotations = annotations;
            })
            .catch(function(err) {
              console.error('Error fetching annotations:', err);
              $scope.annotations = [];
            });
        }
      });

      // TODO, refactor this to look for case OR scorer changes
      $scope.$watch(
        function() {
          return caseSvc.getSelectedCase();
        }, function(acase) {
          if (acase && acase.scores) {
            $scope.scores = acase.scores;
          } else {
            $scope.scores = [];
          }

          // Fetch annotations for the case
          if (acase && acase.caseNo) {
            annotationsSvc.fetchAll(acase.caseNo)
              .then(function(annotations) {
                console.log('Initial fetch of annotations:', annotations);
                $scope.annotations = annotations;
              })
              .catch(function(err) {
                console.error('Error fetching annotations:', err);
                $scope.annotations = [];
              });
          } else {
            $scope.annotations = [];
          }
        }
      );

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



      // Watch for any diff changes and trigger case-level diff scoring
      $scope.$watchCollection(function() {
        return queryViewSvc.getAllDiffSettings();
      }, function() {
        var isEnabled = queryViewSvc.isAnyDiffEnabled();
        if (isEnabled) {
          // Create case-level diffs object similar to individual query diffs
          $scope.queries.avgQuery.diffs = {
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
                // After all individual query scores are calculated, compute case-level scores
                return $scope.queries.avgQuery.diffs.calculateCaseScores();
              }).catch(function() {
                // Case-level diff scoring error - silently handled
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
              
              return $q.resolve();
            }
          };
          
          // Initialize the diffs
          $scope.queries.avgQuery.diffs.fetch();
        } else {
          $scope.queries.avgQuery.diffs = null;
        }
      });

      $scope.queries.queriesChanged = function() {
        return queriesSvc.version();
      };

      function saveScoring() {
        // finished a batch run, log the result!
        var caseNo  = parseInt($routeParams.caseNo, 10);
        var tryNo   = parseInt($routeParams.tryNo, 10);
        
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
      };

      function getScorer() {
        return scorerSvc.defaultScorer;
      }

      /*jslint latedef:false*/
      function pickCaseScorer() {
        var modalInstance = $uibModal.open({
          templateUrl: 'views/pick_scorer.html',
          controller:  'ScorerCtrl',
          resolve:     {
            parent: function() {
              return {
                attachTo:      queriesSvc,
                currentScorer: scorerSvc.defaultScorer,
              };
            },
          }
        });

        modalInstance.result.then(
          function() { },
          function() { }
        );
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
              $scope.queries.sortableOptions.disabled = false;
              break;
            case 'modified':
              $scope.sort = '-modifiedAt';
              $scope.sortName = 'modified';
              $scope.queries.sortableOptions.disabled = true;
              break;
            case 'query':
              $scope.sort = 'queryText';
              $scope.sortName = 'query';
              $scope.queries.sortableOptions.disabled = true;
              break;
            case 'score':
              $scope.sort = '-lastScore';
              $scope.sortName = 'score';
              $scope.queries.sortableOptions.disabled = true;
              break;
            case 'error':
              $scope.sort = ['-errorText', 'allRated'];
              $scope.sortName = 'error';
              $scope.queries.sortableOptions.disabled = true;
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
        if ($scope.queryFilter !== undefined) {
          var lowercaseQueryText = query.queryText.toLowerCase();
          return lowercaseQueryText.includes($scope.queryFilter.toLowerCase());
        }
        else {
          return true;
        }
      };

    }
  ]);
