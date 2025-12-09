'use strict';

angular.module('QuepidApp')
  .controller('JudgementsModalInstanceCtrl', [
    '$rootScope',
    '$scope',
    '$uibModalInstance',
    '$log',
    '$location',
    '$window',
    'flash',
    'caseSvc',
    'bookSvc',
    'queriesSvc',
    'acase',
    'caseTryNavSvc',
    function (
      $rootScope,
      $scope,
      $uibModalInstance,
      $log,
      $location,
      $window,
      flash,
      caseSvc,
      bookSvc,
      queriesSvc,
      acase,
      caseTryNavSvc
     ) {
      var ctrl = this;

      ctrl.refreshOnly = false;
      ctrl.updateAssociatedBook = false;
      ctrl.createMissingQueries = false;

      // why do we do this pattern?
      ctrl.share = {
        acase:            acase,
        books:            [],
        teams:            [],
        loading:          true,
      };

      ctrl.activeBookId = acase.bookId;
      ctrl.activeBookName = acase.bookName;

      $scope.processingPrompt = { inProgress: false, error: null};



      function selectBook(book) {
        var name = (!book ? 'none' : book.name);

        $log.info('selected book: ' + name);

        if (!book) {
          ctrl.activeBookId = null;
          ctrl.activeBookName = null;
        } else {
          ctrl.activeBookId = book.id;
          ctrl.activeBookName = book.name;
        }
        ctrl.updateAssociatedBook = true;
      }

      $scope.selectBook = selectBook;

      var listDoesNotHaveBook = function(list, book) {
        return list.filter(function(o) {
          return o.id === book.id;
        }).length === 0;
      };

      var addBooksToLists = function(books) {
        
        let sortedBooks = [];
        angular.forEach(books, function (book) {
          if (listDoesNotHaveBook(sortedBooks, book)) {
            sortedBooks.push(book);
          }
        });
        
        // Now sort the entire list with active book at the top
        sortedBooks.sort(function(a, b) {
          // If a is the active book, it should come first
          if (a.id === ctrl.activeBookId) {
            return -1;
          }
          // If b is the active book, it should come first
          if (b.id === ctrl.activeBookId) {
            return 1;
          }
          // If neither is the active book, sort alphabetically by name
          return a.name.localeCompare(b.name);
        });
        
        ctrl.share.books = sortedBooks;
      };
      var addTeamToLists = function(team) {
        ctrl.share.teams.push(team);
      };

      // Start loading the list of teams from the case
      angular.forEach(acase.teams, function(team) {
        addTeamToLists(team);
        bookSvc.list(team).then(function(){
          addBooksToLists(bookSvc.books);
        });
      });
      ctrl.share.loading = false;
      // And done, hide loading message.

      ctrl.specificActionLabel = function () {
        var label = '';

        if (ctrl.share.acase.bookId === null && ctrl.activeBookId){
          label = 'Select Book';
        }
        else if (ctrl.share.acase.bookId !== ctrl.activeBookId){
          label = 'Change Book';
        }
        else if (ctrl.share.acase.bookId === ctrl.activeBookId){
          label = '';
          ctrl.refreshOnly = true;
        }

        if (ctrl.populateBook){
          if (!ctrl.updateAssociatedBook){
            label = 'Update Query/Doc Pairs for Book';
          }
          else {
            label = `${label} and Populate`;
          }          
        }
        return label;
      };

      ctrl.refreshRatingsFromBook = function () {
        //$uibModalInstance.close(ctrl.options);
        $scope.processingPrompt.inProgress = true;
        
        // 
        var processInBackground = ctrl.share.acase.queriesCount >= 50 ? true: false;
        bookSvc.refreshCaseRatingsFromBook(ctrl.share.acase.caseNo, ctrl.activeBookId, ctrl.createMissingQueries, processInBackground)
        .then(function(response) {
          $scope.processingPrompt.inProgress = false;
          $uibModalInstance.close(true);

          if (processInBackground === true) {
            flash.success = 'Ratings are being refreshed in the background.';
          }
          else {
            flash.success = 'Ratings have been refreshed.';
          }
          
          // Check if we should redirect to homepage
          if (response && response.data && processInBackground === true) {
            // Short delay to ensure flash message is visible
            setTimeout(function() {
              $window.location.href = caseTryNavSvc.getQuepidRootUrl();
            }, 500);
          }
        }, function(response) {
          $scope.processingPrompt.error = response.data.statusText;
        });
      };

      ctrl.ok = function () {
        $scope.processingPrompt.inProgress  = true;
        $scope.processingPrompt.error       = null;

        if (ctrl.updateAssociatedBook){
          // not handling any errors ;-(
          caseSvc.associateBook(acase, ctrl.activeBookId);
        }
        if (ctrl.populateBook) {
          bookSvc.updateQueryDocPairs(ctrl.activeBookId,ctrl.share.acase.caseNo, queriesSvc.queryArray())
          .then(function() {
            $scope.processingPrompt.inProgress = false;
            $uibModalInstance.close(false);

            flash.success = 'Book of judgements updated.';
          }, function(response) {
            $scope.processingPrompt.inProgress  = false;
            $scope.processingPrompt.error       = response.data.statusText;


          });
        }
        else {
          $uibModalInstance.close(false);
        }
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.goToTeamsPage = function () {
        $uibModalInstance.dismiss('cancel');
        $location.path('/teams');
      };
      
      ctrl.createNewBookLink = function() {
        const teamIds = ctrl.share.acase.teams.map(function(team) {
          return `&team_ids[]=${team.id}`;
        });
        return `books/new?scorer_id=${ctrl.share.acase.scorerId}${teamIds}&origin_case_id=${ctrl.share.acase.caseNo}`;
      };

    }
  ]);
