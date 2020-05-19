'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerCtrl', [
    '$scope', '$location', '$uibModalInstance', '$log',
    'parent', 'customScorerSvc', 'caseSvc', 'queriesSvc',
    'ScorerFactory',
    function (
      $scope, $location, $uibModalInstance, $log,
      parent, customScorerSvc, caseSvc, queriesSvc,
      ScorerFactory
    ) {

      $scope.activeScorer       = parent.currentScorer || {};
      $scope.attachType         = parent.attachType;
      $scope.cancel             = cancel;
      $scope.gotoAdvanced       = gotoAdvanced;
      $scope.ok                 = ok;
      $scope.scorers            = [];
      $scope.defaultScorers     = [];
      $scope.selectScorer       = selectScorer;
      $scope.usingDefaultScorer = usingDefaultScorer;
      $scope.updateButtonLabel  = updateButtonLabel;
      $scope.scorerSelector     = parent.scorerSelector;
      $scope.okButtonLabel      = 'Select Scorer';

      if ($scope.activeScorer.scorerId && ($scope.activeScorer.scorerId !== 'default')) {
        $scope.activeScorer.scorerId = parseInt($scope.activeScorer.scorerId);
      }

      if ($scope.attachType === 'query') {
        /*jshint camelcase:false*/
        if ( parent.attachTo.test !== null ) {
          $scope.scorer = parent.attachTo.test;
        } else {
          var testScorer = new ScorerFactory();
          testScorer.name = 'Test Scorer for query: ID' + parent.attachTo.queryId + ': ' + parent.attachTo.queryText;
          testScorer.query_test = true;

          $scope.scorer = testScorer;
        }
        /*jshint camelcase:true*/
      }

      function updateButtonLabel (value) {
        if (value === 'ad-hoc') {
          $scope.okButtonLabel = 'Save and Select Scorer';
        } else {
          $scope.okButtonLabel = 'Select Scorer';
        }

        $scope.scorerSelector = value;
      }

      /*jslint latedef:false*/
      customScorerSvc.list()
        .then(function() {
          var scorers = customScorerSvc.scorers;
          $scope.scorers = scorers.filter( function (scorer) {
            return !scorer.queryTest;
          });

          $scope.defaultScorers   = customScorerSvc.defaultScorers;
        });

      function cancel() {
        $uibModalInstance.dismiss('cancel');
      }

      function gotoAdvanced() {
        $uibModalInstance.dismiss('cancel');
        $location.path('/advanced');
      }

      function ok() {
        if (parent.attachType === 'query') {
          if ($scope.scorerSelector === 'pre'){
            setScorerForQuery(parent.attachTo);
          } else if ($scope.scorerSelector === 'ad-hoc') {
            parent.attachTo.saveTest($scope.scorer)
              .then(function(response) {
                $scope.activeScorer = response.data;

                setScorerForQuery(parent.attachTo);

                $uibModalInstance.close($scope.activeScorer);
              });

            return;
          }
        } else if (parent.attachType === 'case') {
          setScorerForCase();
        }

        $uibModalInstance.close($scope.activeScorer);
      }

      function selectScorer(scorer) {
        var name = (!scorer ? 'none' : scorer.name);
        //var type = (!scorer ? 'none' : scorer.scorerType);

        $log.info('selected scorer: ' + name);

        if (!scorer) {
          $scope.activeScorer = null;
        } else {
          $scope.activeScorer = scorer;
        }
      }

      function setScorerForCase() {
        var caseNo = queriesSvc.getCaseNo();

        if ($scope.activeScorer) {
          caseSvc.saveDefaultScorer(
            caseNo,
            $scope.activeScorer.scorerId
          ).then(function() {
            // TODO move to customer scorer svc, needs major updates to queriessvc first
            customScorerSvc.setDefault($scope.activeScorer)
              .then(function() {
                $log.info('rescoring queries with new scorer');
                queriesSvc.updateScores();
            });
          });
        } else {
          console.log("Is this dead code path?");
          caseSvc.saveDefaultScorer(caseNo)
            .then(function() {
              // TODO move to customer scorer svc, needs major updates to queriessvc first
              customScorerSvc.resetScorer();
              $log.info('rescoring queries with default scorer');
              queriesSvc.updateScores();
          });
        }
      }

      function setScorerForQuery(query) {
        if ($scope.activeScorer) {
          query.saveScorer($scope.activeScorer);
        } else {
          query.unassignScorer();
        }
      }

      function usingDefaultScorer() {
        return !$scope.activeScorer;
      }
    }
  ]);
