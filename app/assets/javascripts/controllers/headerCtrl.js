'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('HeaderCtrl', [
    '$rootScope',
    '$scope',
    '$route',
    'caseSvc',
    'bookSvc', 
    'caseTryNavSvc',
    function(
      $rootScope,
      $scope,
      $route,
      caseSvc,
      bookSvc,
      caseTryNavSvc
    ) {
      $rootScope.isRailsGoingToAngular = isRailsGoingToAngular;

      $scope.headerScope                = {};
      $scope.headerScope.dropdownCases  = [];
      $scope.headerScope.dropdownBooks  = [];
      $scope.headerScope.casesCount     = 0;
      $scope.headerScope.booksCount     = 0;
      $scope.theCase                    = null;

      $scope.headerScope.goToCase   = goToCase;
      $scope.headerScope.createBookLink = createBookLink;


      $scope.$on('fetchedDropdownCasesList', function() {
        $scope.headerScope.dropdownCases  = caseSvc.dropdownCases;
        $scope.headerScope.casesCount     = caseSvc.casesCount;
      });      

      $scope.$on('fetchedDropdownBooksList', function() {
        $scope.headerScope.dropdownBooks  = bookSvc.dropdownBooks;
        $scope.headerScope.booksCount     = bookSvc.booksCount;
      });
      
      $scope.$on('associateBook', function() {
        bookSvc.fetchDropdownBooks();
      });
        

      angular.forEach(['updatedCasesList', 'caseRenamed'], function (eventName) {
        $scope.$on(eventName, function() {
          caseSvc.fetchDropdownCases();
        });
      });

      // Necessary when the first page isn't the main case page
      caseSvc.fetchDropdownCases();
      bookSvc.fetchDropdownBooks();

      function goToCase($event, aCase) {
        $event.preventDefault();
        caseTryNavSvc.navigateTo({'caseNo': aCase.caseNo, 'tryNo': aCase.lastTry});
      }      

      function isRailsGoingToAngular() {
        return !( angular.isDefined($route.current) && angular.isDefined($route.current.$$route) );
      }
      
      $scope.$on('caseSelected', function() {
        $scope.theCase = caseSvc.getSelectedCase();
      });
      
      function createBookLink() {
        let bookLink = 'books/new';
        if ($scope.theCase){
          const teamIds = $scope.theCase.teams.map(function(team) {
            return `&team_ids[]=${team.id}`;
          });
          bookLink = `${bookLink}?book[scorer_id]=${$scope.theCase.scorerId}${teamIds}&origin_case_id=${$scope.theCase.caseNo}`;
        } 
        return bookLink;
      }
    }
  ]);
