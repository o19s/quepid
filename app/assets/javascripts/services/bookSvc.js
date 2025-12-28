'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('bookSvc', [
    '$http',
    'broadcastSvc',
    function bookSvc($http, broadcastSvc) {
      this.books            = [];
      this.dropdownBooks    = [];
      this.booksCount       = 0;

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

      this.updateQueryDocPairs = function(bookId, caseId, queries) {
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
            // interesting issue, which is for a doc with attributes title and text, if the fieldspec is
            // title:text, title, then we need special logic to actually GET the title attribute out and map it to title_field,
            // because otherwise we just overwrite it.
            if (doc.doc.title !== undefined && doc.doc.title !== doc.title){
              fields['title_field'] = doc.doc.title;
            }          
            
            if (doc.hasThumb()) {              
              if (doc.thumb_options?.prefix){ // jshint ignore:line
                fields['thumb'] = `${doc.thumb_options.prefix}${doc.thumb}`;
              }
              else {
                fields['thumb'] = doc.thumb;
              }
            }
            if (doc.hasImage()){
              if (doc.image_options?.prefix){ // jshint ignore:line
                fields['image'] = `${doc.image_options.prefix}${doc.image}`;
              }
              else {
                fields['image'] = doc.image;
              }
            }

            const queryDocPair = {
              'query_text': query.queryText,
              'doc_id': doc.id,              
              'position': i,
              'document_fields': fields
            };
            
            queryDocPairsPayload.push(queryDocPair);

          });
        });

        const payload = {
          'case_id': caseId,
          'query_doc_pairs': queryDocPairsPayload
        };

        return $http.put('api/books/' + bookId + '/populate', payload)
          .then(function() {
            console.log('Updated book with case query data.');
          });
      };

      this.refreshCaseRatingsFromBook = function(caseId, bookId, createMissingQueries, processInBackground) {
        // http POST api/books/<int:bookId>/case/<int:caseId>/refresh?create_missing_queries=<bool:createMissingQueries>&redirect_to_homepage=<bool:redirectToHomepage>

        var payload = {
        };
        
        var url = 'api/books/' + bookId + '/cases/' + caseId + '/refresh?create_missing_queries=' + createMissingQueries;
        if (processInBackground) {
          url += '&process_in_background=true';
        }

        return $http.put(url, payload)
          .then(function(response) {
            console.log('refreshed ratings' + response.data);
            return response; // Return response to allow checking redirect flag
          });
      };
      
      this.fetchDropdownBooks = function() {
        var self = this;
        self.dropdownBooks.length = 0;
        return $http.get('api/dropdown/books')
          .then(function(response) {
            self.booksCount = response.data.books_count;

            angular.forEach(response.data.books, function(dataBook) {
              let book = self.constructFromData(dataBook);
              
              if(!contains(self.dropdownBooks, book)) {
                self.dropdownBooks.push(book);
              }
            });

            broadcastSvc.send('fetchedDropdownBooksList', self.dropdownBooks);
          });
      };
    }
  ]);
