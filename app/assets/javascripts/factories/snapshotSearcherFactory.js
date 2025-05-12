'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('SnapshotSearcherFactory', [
      '$q',
      '$log',
      'SearchApiDocFactory',
      'activeQueries',
      'searchApiSearcherPreprocessorSvc',
      'esUrlSvc',
      'SearcherFactory',
      'transportSvc',
      'querySnapshotSvc',  
      SnapshotSearcherFactory
    ]);

  function SnapshotSearcherFactory(
    $q, 
    $log,
    SearchApiDocFactory,
    activeQueries,
    searchApiSearcherPreprocessorSvc,
    esUrlSvc,
    SearcherFactory,
    transportSvc,
    querySnapshotSvc
  ) {

    var Searcher = function(options) {
      SearcherFactory.call(this, options, searchApiSearcherPreprocessorSvc);
    };

    Searcher.prototype = Object.create(SearcherFactory.prototype);
    Searcher.prototype.constructor = Searcher; // Reset the constructor

    Searcher.prototype.addDocToGroup    = addDocToGroup;
    Searcher.prototype.pager            = pager;
    Searcher.prototype.search           = search;
    


    /* jshint unused: false */
    function addDocToGroup (groupedBy, group, searchApiDoc) {
      /*jslint validthis:true*/
      console.log('addDocToGroup');
    }

    // return a new searcher that will give you
    // the next page upon search(). To get the subsequent
    // page, call pager on that searcher
    function pager (){
      /*jslint validthis:true*/
      console.log('Pager');
    }

    // search (execute the query) and produce results
    // to the returned future
    function search () {
      console.log('search');
      /*jslint validthis:true*/
      const self= this;
      var url = "fake";//self.callUrl;
      self.inError  = false;
      
      self.snapshot = querySnapshotSvc.snapshots["46"];
      //self.snapshot = querySnapshotSvc.get("46");
      
      //return $q(function (resolve, reject) {
      return $q(function(resolve) {
        console.log("activeQueries.count", activeQueries.count);
        const documents = self.snapshot.getSearchResults("5429");
        activeQueries.count--;
        
        angular.forEach(documents, function(docFromApi) {
          const doc = docFromApi;//parseDoc(docFromApi);
          self.docs.push(doc);
        });
        
        resolve();
      });
        //self.snapshot.getSearchResults("5429")
        //.then(function success(resp) {
            //activeQueries.count--;

            //console.log(resp)

            // do something
           // resolve();
          // }, function error(msg) {
          //   activeQueries.count--;
          //   self.inError = true;
          //   msg.searchError = 'Error looking up query from snapshot';
          //   reject(msg);
          // }).catch(function (response) {
          //   $log.debug('Failed to run search against snapshot');
          //   return response;
          // });
          //});
     
    } // end of search()

    // Return factory object
    return Searcher;
  }
})();
