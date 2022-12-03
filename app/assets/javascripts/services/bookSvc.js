'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('bookSvc', [
    '$http',
    'broadcastSvc',
    function bookSvc($http, broadcastSvc) {
      this.books = [];

      var Book = function(id, name) {
        this.id           = id;
        this.name         = name;
      };

      this.constructFromData = function(data) {
        return new Book(
          data.id,
          data.name
        );
      };

      var contains = function(list, book) {
        return list.filter(function(item) { return item.id === book.id; }).length > 0;
      };

      this.list = function(team) {
        // http GET /teams/<int:teamId>/books
        var url   = '/api/teams/' + team.id + '/books';
        var self  = this;

        // Clear the list just in case the data on the server changed,
        // we want to have the latest list.
        // TODO: write tests for this.
        self.books = [];

        return $http.get(url)
          .then(function(response) {
            angular.forEach(response.data.books, function(dataBook) {
              var book = self.constructFromData(dataBook);

              if(!contains(self.books, book)) {
                self.books.push(book);
              }
            });
          });
      };

      this.shareCase = function(team, book, caseNo) {
        // http POST /api/teams/<int:teamId>/cases
        var url   = '/api/teams/' + team.id + '/cases';
        var data  = {
          id: caseNo,
          book_id: book.id
        };

        return $http.post(url, data)
          .then(function(response) {
            team.cases.push(response.data);

            broadcastSvc.send('bookCaseTeamAdded', {
              caseNo: caseNo,
              team:   team,
            });
          });
      };
    }
  ]);
