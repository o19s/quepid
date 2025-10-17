'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('SnapshotSearcherFactory', [
      '$q',
      '$log',
      'activeQueries',
      'searchApiSearcherPreprocessorSvc',
      'SearcherFactory',
      'querySnapshotSvc',
      'SnapshotDocFactory',  
      SnapshotSearcherFactory
    ]);

  function SnapshotSearcherFactory(
    $q, 
    $log,
    activeQueries,
    searchApiSearcherPreprocessorSvc,
    SearcherFactory,
    querySnapshotSvc,
    SnapshotDocFactory
  ) {

    // Define the Searcher constructor
    var Searcher = function(options) {
      SearcherFactory.call(this, options, searchApiSearcherPreprocessorSvc);
      this.queryId = options.queryId;
      this.snapshotId = options.snapshotId;
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup = addDocToGroup;
    Searcher.prototype.pager = pager;
    Searcher.prototype.search = search;

    /* jshint unused: false */
    function addDocToGroup(groupedBy, group, searchApiDoc) {
      /*jslint validthis:true*/
      // In snapshot mode, grouping is not supported
      $log.debug('SnapshotSearcher: addDocToGroup not implemented for snapshots');
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher
    function pager() {
      /*jslint validthis:true*/
      // Pagination not fully implemented for snapshots as they typically contain limited result sets
      $log.debug('SnapshotSearcher: Pagination not fully implemented for snapshots');
      return this;
    }

    // search (execute the query) and produce results
    function search() {
      /*jslint validthis:true*/
      const self = this;
      self.inError = false;
      
      const snapshotId = self.snapshotId;
      const queryId = self.queryId;
      
      if (!snapshotId || !queryId) {
        $log.error('SnapshotSearcher: Missing snapshotId or queryId', {
          snapshotId: snapshotId,
          queryId: queryId
        });
        self.inError = true;
        return $q.reject('Missing snapshot or query information');
      }

      // Get the snapshot from the service
      return querySnapshotSvc.ensureFullSnapshot(snapshotId)
        .then(function(snapshot) {
          if (!snapshot) {
            $log.error('SnapshotSearcher: Snapshot not found', snapshotId);
            self.inError = true;
            return $q.reject('Snapshot not found: ' + snapshotId);
          }
          
          return $q(function(resolve, reject) {
            try {
              // Get documents for this specific query from the snapshot
              const documents = snapshot.getSearchResults(queryId);
              
              if (activeQueries.count > 0) {
                activeQueries.count--;
              }
              
              // Clear any existing docs
              self.docs = [];
              
              // Process the documents
              if (documents && documents.length > 0) {
                angular.forEach(documents, function(docFromApi) {
                  // Create a proper document using SnapshotDocFactory
                  var options = {
                    fieldList: self.fieldList
                  };
                  
                  var doc = new SnapshotDocFactory(docFromApi, options);
                  self.docs.push(doc);
                });
              }
              
              // Set the number of results found
              self.numFound = self.docs.length;
              resolve();
            } catch (error) {
              $log.error('SnapshotSearcher: Error processing results', error);
              self.inError = true;
              reject('Error processing snapshot results: ' + (error.message || error));
            }
          });
        })
        .catch(function(error) {
          $log.error('SnapshotSearcher: Error retrieving snapshot', error);
          self.inError = true;
          return $q.reject('Error retrieving snapshot: ' + error);
        });
    }

    // Return factory object
    return Searcher;
  }
})();
