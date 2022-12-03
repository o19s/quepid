'use strict';

angular.module('QuepidApp')
  .controller('PopulateJudgementsModalInstanceCtrl', [
    '$rootScope',
    '$scope',
    '$uibModalInstance',
    '$log',
    '$location',
    'teamSvc',
    'bookSvc',
    'acase',
    function (
      $rootScope,
      $scope,
      $uibModalInstance,
      $log,
      $location,
      teamSvc,
      bookSvc,
      acase
     ) {
      var ctrl = this;

      ctrl.canUpdateCase = false;
      ctrl.canCreateTeam = false;

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

      $scope.selectBook = selectBook;

      function selectBook(book) {
        var name = (!book ? 'none' : book.name);

        $log.info('selected book: ' + name);

        if (!book) {
          ctrl.activeBookId = null;
        } else {
          ctrl.activeBookId = book.id;
        }
      }

      var listDoesNotHaveTeam = function(list, team) {
        return list.filter(function(o) {
          return o.id === team.id;
        }).length === 0;
      };

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
      }
      var addTeamToLists = function(team) {
        // ERic: unclear if we care about the sharing status of a case or not!
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
        var label = "";
        var refreshOnly = false;
        if (ctrl.share.acase.bookId === null && ctrl.activeBookId){
          label = "Select Book";
        }
        else if (ctrl.share.acase.bookId !== ctrl.activeBookId){
          label = "Change Book";
        }
        else if (ctrl.share.acase.bookId === ctrl.activeBookId){
          label = ""
          refreshOnly = true;
        }

        if (ctrl.populateBook){
          if (refreshOnly){
            label = "Refresh Query/Doc Pairs for Book"
          }
          else {
            label = label + " and Populate";
          }
        }
        return label;
      };

      ctrl.ok = function () {
        $uibModalInstance.close(ctrl.share);
      };

      ctrl.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      ctrl.goToTeamsPage = function () {
        $uibModalInstance.dismiss('cancel');
        $location.path('/teams');
      };

    }
  ]);
