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
        var url   = 'api/teams/' + team.id + '/books';
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
        // http POST api/teams/<int:teamId>/cases
        var url   = 'api/teams/' + team.id + '/cases';
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

      this.updateQueryDocPairs = function(bookId, queries) {
        // http POST api/books/<int:bookId>/populate
        var queryDocPairsPayload = [];
        angular.forEach(queries, function(query) {
          // Save all matches
          var i = 0;
          angular.forEach(query.docs, function(doc) {
            i = i + 1;
            var fields = {};
            angular.forEach(Object.values(doc.subsList), function(field) {
              fields[field['field']] = field['value'];
            });
            fields['title'] = doc.title;
            if (doc.hasThumb()) {
              fields['thumb'] = doc.thumb;
            }
            if (doc.hasImage()){
              fields['image'] = doc.image;
            }

            var queryDocPair = {
              'query_text': query.queryText,
              'doc_id': doc.id,
              'position': i,
              'document_fields': fields
            };

            queryDocPairsPayload.push(queryDocPair);

          });
        });

        var payload = {
          'query_doc_pairs': queryDocPairsPayload
        };

        return $http.put('api/books/' + bookId + '/populate', payload)
          .then(function(response) {
            console.log('Updated book' + response.data);
          });
      };

      this.refreshCaseRatingsFromBook = function(caseId, bookId) {
        // http POST api/books/<int:bookId>/case/<int:caseId>/refresh

        var payload = {
        };

        return $http.put('api/books/' + bookId + '/cases/' + caseId + '/refresh', payload)
          .then(function(response) {
            console.log('refreshed ratings' + response.data);
          });
      };
    }
  ]);
