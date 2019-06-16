'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('HeaderCtrl', [
    '$rootScope',
    '$scope',
    '$route',
    '$uibModal',
    'caseSvc', 'caseTryNavSvc',
    function(
      $rootScope,
      $scope,
      $route,
      $uibModal,
      caseSvc,
      caseTryNavSvc
    ) {
      $rootScope.isRailsGoingToAngular = isRailsGoingToAngular;

      $scope.headerScope                = {};
      $scope.headerScope.dropdownCases  = [];
      $scope.headerScope.casesCount     = 0;

      $scope.headerScope.goToCase   = goToCase;

      angular.forEach(['fetchedDropdownCasesList'], function (eventName) {
        $scope.$on(eventName, function() {
          $scope.headerScope.dropdownCases  = caseSvc.dropdownCases;
          $scope.headerScope.casesCount     = caseSvc.casesCount;
        });
      });

      angular.forEach(['updatedCasesList', 'caseRenamed'], function (eventName) {
        $scope.$on(eventName, function() {
          caseSvc.fetchDropdownCases();
        });
      });

      // Necessary when the first page isn't the main case page
      caseSvc.fetchDropdownCases();

      function goToCase($event, aCase) {
        $event.preventDefault();
        caseTryNavSvc.navigateTo({'caseNo': aCase.caseNo, 'tryNo': aCase.lastTry});
      }

      function isRailsGoingToAngular() {
        return !( angular.isDefined($route.current) && angular.isDefined($route.current.$$route) );
      }
    }
  ]);
