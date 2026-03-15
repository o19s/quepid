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

      ctrl.createMissingQueries = false;
      ctrl.autoPopulateBookPairs = acase.autoPopulateBookPairs || false;
      ctrl.autoPopulateCaseJudgements    = acase.autoPopulateCaseJudgements !== false;

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
        $log.info('activeBookId is now:', ctrl.activeBookId);
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

      ctrl.hasUnsavedChanges = function () {
        var bookChanged = ctrl.activeBookId !== ctrl.share.acase.bookId;
        var syncChanged = ctrl.autoPopulateBookPairs !== (acase.autoPopulateBookPairs || false) ||
                          ctrl.autoPopulateCaseJudgements !== (acase.autoPopulateCaseJudgements !== false);
        var createMissingQueriesChanged = ctrl.createMissingQueries !== false;
        return bookChanged || syncChanged || createMissingQueriesChanged;
      };

      ctrl.ok = function () {
        $scope.processingPrompt.inProgress  = true;
        $scope.processingPrompt.error       = null;

        var bookChanged = ctrl.activeBookId !== ctrl.share.acase.bookId;

        // Save book association and sync settings in a single request
        caseSvc.saveBookSettings(acase, ctrl.activeBookId, ctrl.autoPopulateBookPairs, ctrl.autoPopulateCaseJudgements);

        // Refresh ratings if auto-populate is enabled and book changed, or if createMissingQueries is checked
        var shouldRefreshRatings = (ctrl.autoPopulateCaseJudgements && bookChanged && ctrl.activeBookId) || ctrl.createMissingQueries;

        if (shouldRefreshRatings && ctrl.activeBookId) {
          var processInBackground = ctrl.share.acase.queriesCount >= 50 ? true : false;
          bookSvc.refreshCaseRatingsFromBook(ctrl.share.acase.caseNo, ctrl.activeBookId, ctrl.createMissingQueries, processInBackground)
          .then(function(response) {
            $scope.processingPrompt.inProgress = false;
            $uibModalInstance.close(true);

            if (processInBackground) {
              flash.success = 'Settings saved. Ratings are being refreshed in the background.';
            }
            else {
              flash.success = 'Settings saved. Ratings have been refreshed.';
            }

            // Check if we should redirect to homepage
            if (response && response.data && processInBackground) {
              setTimeout(function() {
                $window.location.href = caseTryNavSvc.getQuepidRootUrl();
              }, 500);
            }
          }, function(response) {
            $scope.processingPrompt.error = response.data.statusText;
          });
          return;
        }

        flash.success = 'Settings saved.';
        $uibModalInstance.close(false);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.goToTeamsPage = function () {
        $uibModalInstance.dismiss('cancel');
        var url = caseTryNavSvc.getQuepidRootUrl() + '/teams';
        window.location.href = url;
      };
      
      ctrl.manualPopulateBook = function() {
        $scope.processingPrompt.inProgress = true;
        bookSvc.updateQueryDocPairs(ctrl.activeBookId, ctrl.share.acase.caseNo, queriesSvc.queryArray())
        .then(function() {
          $scope.processingPrompt.inProgress = false;
          flash.success = 'Updating Book with Query Doc Pairs.';
          $uibModalInstance.close(false);
        }, function(response) {
          $scope.processingPrompt.inProgress = false;
          $scope.processingPrompt.error = response.data.statusText;
        });
      };

      ctrl.manualRefreshRatings = function() {
        $scope.processingPrompt.inProgress = true;
        var processInBackground = ctrl.share.acase.queriesCount >= 50 ? true : false;
        bookSvc.refreshCaseRatingsFromBook(ctrl.share.acase.caseNo, ctrl.activeBookId, ctrl.createMissingQueries, processInBackground)
        .then(function() {
          $scope.processingPrompt.inProgress = false;

          if (processInBackground) {
            flash.success = 'Case ratings are being refreshed from book in the background.';
          }
          else {
            flash.success = 'Case ratings refreshed from book.';
          }
          $uibModalInstance.close(true);
        }, function(response) {
          $scope.processingPrompt.inProgress = false;
          $scope.processingPrompt.error = response.data.statusText;
        });
      };

      ctrl.createNewBookLink = function() {
        const teamIds = ctrl.share.acase.teams.map(function(team) {
          return `&team_ids[]=${team.id}`;
        });
        return `books/new?scorer_id=${ctrl.share.acase.scorerId}${teamIds}&origin_case_id=${ctrl.share.acase.caseNo}`;
      };

    }
  ]);
