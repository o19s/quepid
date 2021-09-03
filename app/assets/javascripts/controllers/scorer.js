'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerCtrl', [
    '$scope', '$location', '$uibModalInstance', '$log',
    'parent', 'scorerSvc', 'caseSvc', 'queriesSvc',
    'ScorerFactory', 'configurationSvc',
    function (
      $scope, $location, $uibModalInstance, $log,
      parent, scorerSvc, caseSvc, queriesSvc,
      ScorerFactory, configurationSvc
    ) {

      $scope.activeScorer       = parent.currentScorer || {};
      $scope.cancel             = cancel;
      $scope.gotoScorers        = gotoScorers;
      $scope.ok                 = ok;
      $scope.scorers            = [];
      $scope.communalScorers    = [];
      $scope.selectScorer       = selectScorer;
      $scope.usingDefaultScorer = usingDefaultScorer;
      $scope.communalScorersOnly = configurationSvc.isCommunalScorersOnly();

      if ($scope.activeScorer.scorerId && ($scope.activeScorer.scorerId !== 'default')) {
        $scope.activeScorer.scorerId = parseInt($scope.activeScorer.scorerId);
      }

      /*jslint latedef:false*/
      scorerSvc.list()
        .then(function() {
          $scope.userScorers     = scorerSvc.scorers;
          $scope.communalScorers = scorerSvc.communalScorers;
        });

      function cancel() {
        $uibModalInstance.dismiss('cancel');
      }

      function gotoScorers() {
        $uibModalInstance.dismiss('cancel');
        $location.path('/scorers');
      }

      function ok() {
        setScorerForCase();

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
            // TODO move to scorer svc, needs major updates to queriessvc first
            scorerSvc.setDefault($scope.activeScorer)
              .then(function() {
                $log.info('rescoring queries with new scorer');
                queriesSvc.updateScores();
            });
          });
        } else {
          $log.info('Is this dead code path?');
          caseSvc.saveDefaultScorer(caseNo)
            .then(function() {
              // TODO move to customer scorer svc, needs major updates to queriessvc first
              scorerSvc.resetScorer();
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
