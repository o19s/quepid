'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerCtrl', [
    '$scope', '$location', '$uibModalInstance', '$log',
    'parent', 'customScorerSvc', 'caseSvc', 'queriesSvc',
    'ScorerFactory', 'configurationSvc',
    function (
      $scope, $location, $uibModalInstance, $log,
      parent, customScorerSvc, caseSvc, queriesSvc,
      ScorerFactory, configurationSvc
    ) {

      $scope.activeScorer       = parent.currentScorer || {};
      $scope.attachType         = parent.attachType;
      $scope.cancel             = cancel;
      $scope.gotoAdvanced       = gotoAdvanced;
      $scope.ok                 = ok;
      $scope.scorers            = [];
      $scope.communalScorers    = [];
      $scope.selectScorer       = selectScorer;
      $scope.usingDefaultScorer = usingDefaultScorer;
      $scope.updateButtonLabel  = updateButtonLabel;
      $scope.scorerSelector     = parent.scorerSelector;
      $scope.okButtonLabel      = 'Select Scorer';
      $scope.communalScorersOnly = configurationSvc.isCommunalScorersOnly();

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
        if (value === 'unit-test') {
          $scope.okButtonLabel = 'Save Unit Test Scorer';
        } else {
          $scope.okButtonLabel = 'Restore Case Scorer';
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

          $scope.communalScorers = customScorerSvc.communalScorers;
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
          var query = parent.attachTo;
          if ($scope.scorerSelector === 'pre'){
            query.unassignScorer();
          } else if ($scope.scorerSelector === 'unit-test') {
            parent.attachTo.saveTest($scope.scorer)
              .then(function(scorer) {
                //deal with the updated unit test style scorer
                $scope.activeScorer = scorer;
                query.saveScorer($scope.activeScorer);

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
          console.log('Is this dead code path?');
          caseSvc.saveDefaultScorer(caseNo)
            .then(function() {
              // TODO move to customer scorer svc, needs major updates to queriessvc first
              customScorerSvc.resetScorer();
              $log.info('rescoring queries with default scorer');
              queriesSvc.updateScores();
          });
        }
      }

      function usingDefaultScorer() {
        return !$scope.activeScorer;
      }
    }
  ]);
