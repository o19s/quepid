'use strict';
/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('queriesCtrl', [
    '$scope',
    '$rootScope',
    '$log',
    '$location',
    '$routeParams',
    '$uibModal',
    'queriesSvc',
    'queryViewSvc',
    'querySnapshotSvc',
    'diffResultsSvc',
    'caseSvc',
    'customScorerSvc',
    function (
      $scope,
      $rootScope,
      $log,
      $location,
      $routeParams,
      $uibModal,
      queriesSvc,
      queryViewSvc,
      querySnapshotSvc,
      diffResultsSvc,
      caseSvc,
      customScorerSvc
    ) {

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
      $scope.toggleShowOnlyRated      = toggleShowOnlyRated;

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

        resultObject.lastScore = queriesSvc.scoreAll();
        lastVersion            = queriesSvc.version();

        if (
          resultObject.lastScore &&
          resultObject.lastScore !== -1
        ) {
          var scoreInfo = resultObject.lastScore;

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
        lastScore: -1,
        score: function() {
          // rescore only if
          // - there are no unscored queries
          // - we seem to have a new version of the query service
          if (!queriesSvc.hasUnscoredQueries() &&
              (lastVersion !== queriesSvc.version())) {

            runScore(this);
            saveScoring();
          }

          return this.lastScore;
        },
        diff: {
          score: function() {
            return queriesSvc.scoreAllDiffs();
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
        if (queryViewSvc.diffSetting === null) {
          return 'disabled';
        }
        else if (queryViewSvc.diffSetting === 'best') {
          return 'target';
        } else {
          return 'snapshot';
        }
        return 'meow';
      };

      $scope.queries.fullDiffName = function() {
        if (queryViewSvc.diffSetting === null) {
          return 'disabled';
        }
        else if (queryViewSvc.diffSetting === 'best') {
          return 'Highest ratest results for each query';
        } else {
          var snapshot = querySnapshotSvc.snapshots[queryViewSvc.diffSetting];
          return snapshot.name();
        }
      };

      function saveScoring() {
        // finished a batch run, log the result!
        var caseNo  = parseInt($routeParams.caseNo, 10);
        var tryNo   = parseInt($routeParams.tryNo, 10);

        if ( isNaN(tryNo) ) {  // If we didn't specify a try, then we need to get the latest
          caseSvc.get(caseNo)
            .then(function(acase) {

              tryNo = acase.lastTry;

              lastScoreTracker = {
                'score':      $scope.queries.avgQuery.lastScore.score,
                'all_rated':  $scope.queries.avgQuery.lastScore.allRated,
                'try_id':     tryNo,
                'queries':    $scope.queries.avgQuery.lastScore.queries,
              };

              $log.info('sending score information to mothership');
              caseSvc.trackLastScore(caseNo, lastScoreTracker);
            });
        }
        else {
          var lastScoreTracker = {
            'score':      $scope.queries.avgQuery.lastScore.score,
            'all_rated':  $scope.queries.avgQuery.lastScore.allRated,
            'try_id':     tryNo,
            'queries':    $scope.queries.avgQuery.lastScore.queries,
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
        return customScorerSvc.defaultScorer;
      }

      /*jslint latedef:false*/
      function pickCaseScorer() {
        var modalInstance = $uibModal.open({
          templateUrl: 'views/pick_scorer.html',
          backdrop:    'static',
          controller:  'ScorerCtrl',
          resolve:     {
            parent: function() {
              return {
                attachType:    'case',
                attachTo:      queriesSvc,
                currentScorer: customScorerSvc.defaultScorer,
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

      function toggleShowOnlyRated() {
        var sor = $rootScope.showOnlyRated;
        console.log('Toggle button pressed, sor= ' + sor);
        if (sor === undefined) {
          sor = false;
        }
        if (sor === 'false') {
          sor = 'true';
        } else {
          sor = 'false';
        }
        $rootScope.showOnlyRated = sor.toString();
        console.log('showOnlyRated is now toggled to ' + sor);
        $scope.queries.showOnlyRated = sor.toString();
        $location.search('showOnlyRated', sor.toString());
        console.log('Reloading page for sor');
        location.reload();
      }
    }
  ]);
