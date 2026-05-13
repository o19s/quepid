'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerCtrl', [
    '$scope', '$window', '$quepidModalInstance', '$log',
    'parent', 'scorerSvc', 'caseSvc', 'queriesSvc',
    'configurationSvc', 'caseTryNavSvc',
    function (
      $scope, $window, $quepidModalInstance, $log,
      parent, scorerSvc, caseSvc, queriesSvc,
      configurationSvc, caseTryNavSvc
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
          $scope.scorerAccessible = scorerAccessible();
        });

      function cancel() {
        $quepidModalInstance.dismiss('cancel');
      }

      function gotoScorers() {
        $quepidModalInstance.dismiss('cancel');
        $window.location.href = caseTryNavSvc.getQuepidRootUrl() + '/scorers';
      }

      function ok() {
        setScorerForCase();

        $quepidModalInstance.close($scope.activeScorer);
      }

      function scorerAccessible() {
        let scorerAccessible = false;

        if ($scope.activeScorer.scorerId) {
          angular.forEach($scope.userScorers.concat($scope.communalScorers), function (scorer){
            if (scorer.scorerId === $scope.activeScorer.scorerId){
              scorerAccessible = true;
              return scorerAccessible;
            }
          });
        }
        return scorerAccessible;

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
