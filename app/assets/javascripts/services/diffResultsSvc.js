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
    'multiDiffResultsSvc',
    function diffResultsSvc(
      $q,
      $log,
      querySnapshotSvc,
      settingsSvc,
      snapshotSearcherSvc,
      multiDiffResultsSvc
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
          // Delegate single snapshot diffs to multiDiff for unified code path
          multiDiffResultsSvc.setMultiDiffSettings([diffSetting]);
          multiDiffResultsSvc.createQueryMultiDiff(query);
          
          // Create compatibility wrapper to maintain old diff interface
          if (query.multiDiff) {
            query.diff = {
              fetch: function() {
                return query.multiDiff.fetch();
              },
              
              docs: function(onlyRated) {
                return query.multiDiff.docs(0, onlyRated);
              },
              
              name: function() {
                return query.multiDiff.name(0);
              },
              
              version: function() {
                return query.multiDiff.version(0);
              },
              
              score: function() {
                return query.multiDiff.score(0);
              },
              
              type: function() {
                return 'snapshot';
              },
              
              get diffScore() {
                var searchers = query.multiDiff.getSearchers();
                return searchers[0] ? searchers[0].diffScore : { score: null, allRated: false };
              },
              
              get currentScore() {
                return this.diffScore;
              }
            };
          }
          
          // Keep the old implementation as fallback (commented out for now)
          /*
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
                    return query.scoreOthers(docsForScoring);
                  })
                  .then(function(scoreResult) {
                    query.diff.diffScore = scoreResult;
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
              
              diffScore: { score: null, allRated: false },
              
              get currentScore() {
                return this.diffScore;
              }
            };
            
            // Initialize the diff
            query.diff.fetch();
          } else {
            console.debug('snapshot not found!');
            query.diff = null;
            query.diffSearcher = null;
          }
          */
        }
      };
    }
  ]);
