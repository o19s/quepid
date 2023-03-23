'use strict';

angular.module('QuepidApp')
  .controller('JudgementsModalInstanceCtrl', [
    '$rootScope',
    '$scope',
    '$uibModalInstance',
    '$log',
    '$location',
    'flash',
    'teamSvc',
    'caseSvc',
    'bookSvc',
    'queriesSvc',
    'acase',
    function (
      $rootScope,
      $scope,
      $uibModalInstance,
      $log,
      $location,
      flash,
      teamSvc,
      caseSvc,
      bookSvc,
      queriesSvc,
      acase
     ) {
      var ctrl = this;

      ctrl.canUpdateCase = false;
      ctrl.canCreateTeam = false;
      ctrl.refreshOnly = false;
      ctrl.updateAssociatedBook = false;

      $rootScope.$watch('currentUser', function() {
        if ( $rootScope.currentUser ) {
          ctrl.canUpdateCase = $rootScope.currentUser.permissions.case.update;
          ctrl.canCreateTeam = $rootScope.currentUser.permissions.team.create;
        }
      });

      // why do we do this pattern?
      ctrl.share = {
        acase:            acase,
        books:            [],
        teams:            [],
        loading:          true,
      };

      ctrl.activeBookId = acase.bookId;

      $scope.processingPrompt = { inProgress: false, error: null};



      function selectBook(book) {
        var name = (!book ? 'none' : book.name);

        $log.info('selected book: ' + name);

        if (!book) {
          ctrl.activeBookId = null;
        } else {
          ctrl.activeBookId = book.id;
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
        angular.forEach(books, function (book) {
          if (listDoesNotHaveBook(ctrl.share.books, book)) {
            ctrl.share.books.push(book);
          }
        });
      };
      var addTeamToLists = function(team) {
        ctrl.share.teams.push(team);
      };

      teamSvc.list(false)
        .then(function() {
          angular.forEach(teamSvc.teams, function(team) {
            addTeamToLists(team);
            bookSvc.list(team).then(function(){
              addBooksToLists(bookSvc.books);
            });
          });

          ctrl.share.loading = false;
        }, function(response) {
          $log.debug(response.data);
        });

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
            label = 'Refresh Query/Doc Pairs for Book';
          }
          else {
            label = label + ' and Populate';
          }
        }
        return label;
      };

      ctrl.refreshRatingsFromBook = function () {
        //$uibModalInstance.close(ctrl.options);
        bookSvc.refreshCaseRatingsFromBook(ctrl.share.acase.caseNo, ctrl.activeBookId)
        .then(function() {
          $scope.processingPrompt.inProgress = true;
          $uibModalInstance.close();

          flash.success = 'Ratings have been refreshed.';
        }, function(response) {
          $scope.processingPrompt.inProgress  = false;
          $scope.processingPrompt.error       = response.data.statusText;
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
          bookSvc.updateQueryDocPairs(ctrl.activeBookId, queriesSvc.queryArray())
          .then(function() {
            $scope.processingPrompt.inProgress = false;
            $uibModalInstance.close();

            flash.success = 'Book of judgements updated.';
          }, function(response) {
            $scope.processingPrompt.inProgress  = false;
            $scope.processingPrompt.error       = response.data.statusText;

            // we could take the error and pass it out via
            //$uibModalInstance.close($scope.processingPrompt.error);
          });
        }
        else {
          $uibModalInstance.close();
        }
      };

      //ctrl.ok = function () {
        //$uibModalInstance.close(ctrl.share);
      //};

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.goToTeamsPage = function () {
        $uibModalInstance.dismiss('cancel');
        $location.path('/teams');
      };

    }
  ]);
