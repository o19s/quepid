'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('CasesCtrl', [
    '$scope',
    '$q',
    'broadcastSvc',
    'caseSvc', 'caseTryNavSvc',
    function (
      $scope,
      $q,
      broadcastSvc,
      caseSvc, caseTryNavSvc
    ) {
      $scope.casesScope               = {};
      $scope.casesScope.allCases      = [];
      $scope.casesScope.typeFilter    = 'all';
      $scope.casesScope.loadingCases  = false;

      $scope.pagination = {
        cases: {
          currentPage:  1,
          pageSize:     10
        }
      };

      $scope.casesScope.goToCase  = goToCase;

      var fetchDeepCaseList = function() {
        $scope.casesScope.loadingCases = true;

        caseSvc.getCases(false)
          .then(function() {
            broadcastSvc.send('updatedCasesList', caseSvc.allCases);

            if ( caseSvc.allCases.length ) {
              var promises = [];

              caseSvc.allCases.forEach(function(aCase) {
                promises.push( caseSvc.get(aCase.caseNo, false) );
              });

              $q.all(promises)
                .then(function() {
                  broadcastSvc.send('deepCaseListUpdated', caseSvc.allCases);
                  $scope.casesScope.loadingCases = false;
                });
            }
          });
      };

      if (  angular.isUndefined($scope.casesScope.allCases) ||
            $scope.casesScope.allCases.length === 0
      ) {
        fetchDeepCaseList();
      }

      angular.forEach(['bootstrapped', 'updatedCasesList', 'settings-updated', 'updatedCaseScore', 'caseRenamed', 'deepCaseListUpdated'], function (eventName) {
        $scope.$on(eventName, function() {
          $scope.casesScope._internalCaseList = caseSvc.allCases;
          getLists();
        });
      });

      $scope.$watchCollection('_internalCaseList', function() {
        getLists();
      });

      var getLists = function () {
        $scope.casesScope.allCases.length = 0;
        angular.copy(caseSvc.allCases, $scope.casesScope.allCases);
      };

      function goToCase(aCase) {
        caseTryNavSvc.navigateTo({'caseNo': aCase.caseNo, 'tryNo': aCase.lastTry});
      }
    }
  ]);
