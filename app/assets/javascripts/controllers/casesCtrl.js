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
      $scope.sortBy                   = sortBy;
      
      function sortBy(field) {       
        console.log("Here i am:" + field);
        if (field === 'caseName'){
          $scope.casesScope.allCases = $scope.casesScope.allCases.sort(function (a, b) {
            var alc = a[field].toLowerCase(),
                  blc = b[field].toLowerCase();
            return alc > blc ? 1 : alc < blc ? -1 : 0;
          });
        }
        else if (field === 'lastScore') {     
          $scope.casesScope.allCases = $scope.casesScope.allCases.sort(function (a, b) {     
            let da = angular.isUndefined(a.lastScore)? new Date() : new Date(a.lastScore.created_at);
            let db = angular.isUndefined(b.lastScore)? new Date() : new Date(b.lastScore.created_at);
            return da - db;
          });
        }
      }

      var fetchDeepCaseList = function() {
        $scope.casesScope.loadingCases = true;

        caseSvc.getCases(false)
          .then(function() {
            broadcastSvc.send('updatedCasesList', caseSvc.allCases);
            $scope.casesScope.loadingCases = false;
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
