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
      configurationSvc
    ) {
      $scope.queriesSvc = queriesSvc;
      $scope.caseSvc = caseSvc;
      $scope.queryListSortable = configurationSvc.isQueryListSortable();

      $rootScope.$on('scoring-complete', () => {
        $scope.queries.avgQuery.calcScore();
      });

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


      $scope.$on('updatedCaseScore', function(event, theCase) {
        if (theCase.caseNo === caseSvc.getSelectedCase().caseNo) {
          caseSvc.getSelectedCase()
            .fetchCaseScores()
            .then(function(returnedCase) {
              $scope.scores = returnedCase.scores;
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
        score: () => {
          var deferred = $q.defer();
          deferred.resolve($scope.queries.avgQuery.diff.currentScore);
          return deferred.promise;
        },
        diff: {
          score: function() {
            return queriesSvc.scoreAllDiffs().then( (scoreInfo) => {
              $scope.queries.avgQuery.diff.currentScore = scoreInfo;
              return scoreInfo;
            });
          }
        }
        //var diff: null, // TODO fill out
      };

      $scope.queries.queriesChanged = function() {
        return queriesSvc.version();
      };

      $scope.queries.selectedDiff = function() {
        return queryViewSvc.diffSetting;
      };

      $scope.queries.selectedDiffName = function() {
        var diffName = '';
        if (queryViewSvc.diffSetting === null) {
          diffName = 'disabled';
        }
        else if (queryViewSvc.diffSetting === 'best') {
          diffName = 'target';
        } else {
          diffName = 'snapshot';
        }
        return diffName;
      };

      $scope.queries.fullDiffName = function() {
        var fullDiffName = '';
        if (queryViewSvc.diffSetting === null) {
          fullDiffName = 'disabled';
        }
        else if (queryViewSvc.diffSetting === 'best') {
          fullDiffName = 'Highest ratest results for each query';
        } else {
          var snapshot = querySnapshotSvc.snapshots[queryViewSvc.diffSetting];
          // When reopening the snapshot selection UI we clear out the querySnapshotSvc.snapshots
          // while reloading the data.
          if (snapshot) { 
            fullDiffName = snapshot.name();
          }
        }
        return fullDiffName;
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
