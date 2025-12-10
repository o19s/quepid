'use strict';
/*
 * Responsible for managing all the fiddly details
 * with the second set of search results (ie diffs)
 * we're viewing
 * */
angular.module('QuepidApp')
  .service('diffResultsSvc', [
    '$q',
    '$log',
    'querySnapshotSvc',
    'settingsSvc',
    'snapshotSearcherSvc',
    function diffResultsSvc(
      $q,
      $log,
      querySnapshotSvc,
      settingsSvc,
      snapshotSearcherSvc
    ) {

      var diffSetting = null;

      this.setDiffSetting = function(currDiffSetting) {
        diffSetting = currDiffSetting;
      };

      this.createQueryDiff = function(query) {
        if (diffSetting === null) {
          query.diff = null;
          query.diffSearcher = null;          
        } else {
          var settings = settingsSvc.editableSettings();
          var diffSearcher = snapshotSearcherSvc.createSearcherFromSnapshot(diffSetting, query, settings);

          if (diffSearcher) {
            query.diffSearcher = diffSearcher;
            
            // Create a compatibility wrapper that maintains the old interface
            query.diff = {
              fetch: function() {
                return diffSearcher.search()
                  .then(function() {
                    // Calculate diff score using the searcher's docs
                    var docsForScoring = diffSearcher.docs.filter(function(d) { 
                      return d.ratedOnly === false; 
                    });
                    query.diff.diffScore = query.scoreOthers(docsForScoring);
                  });
              },
              
              docs: function(onlyRated) {
                onlyRated = onlyRated || false;
                return diffSearcher.docs.filter(function(d) { 
                  return d.ratedOnly === onlyRated; 
                });
              },
              
              name: function() {
                return diffSearcher.name();
              },
              
              version: function() {
                return diffSearcher.version();
              },
              
              score: function() {
                var deferred = $q.defer();
                deferred.resolve(query.diff.diffScore || { score: null, allRated: false });
                return deferred.promise;
              },
              
              type: function() {
                return 'snapshot';
              },
              
              diffScore: { score: null, allRated: false }
            };
            
            // Initialize the diff
            query.diff.fetch();
          } else {
            console.debug('snapshot not found!');
            query.diff = null;
            query.diffSearcher = null;
          }
        }
      };
    }
  ]);
