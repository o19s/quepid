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
    'queryViewSvc',
    function diffResultsSvc(
      $q,
      $log,
      querySnapshotSvc,
      settingsSvc,
      snapshotSearcherSvc,
      queryViewSvc
    ) {

      // Internal method to create multiDiff objects
      function createQueryMultiDiff(query, diffSettings) {
        if (diffSettings.length === 0) {
          query.multiDiff = null;
          query.multiDiffSearchers = [];
          return;
        }

        var settings = settingsSvc.editableSettings();
        var diffSearchers = [];
        var validSearchers = [];

        // Create searchers for each snapshot
        angular.forEach(diffSettings, function(diffSetting) {
          var diffSearcher = snapshotSearcherSvc.createSearcherFromSnapshot(diffSetting, query, settings);
          if (diffSearcher) {
            // Initialize diffScore immediately for qscore components
            diffSearcher.diffScore = { score: '?', allRated: false };
            
            // Add currentScore getter to make searcher compatible with qscore components
            Object.defineProperty(diffSearcher, 'currentScore', {
              get: function() {
                return this.diffScore;
              },
              enumerable: true,
              configurable: true
            });
            
            diffSearchers.push(diffSearcher);
            validSearchers.push({
              searcher: diffSearcher,
              setting: diffSetting
            });
          }
        });

        if (validSearchers.length > 0) {
          query.multiDiffSearchers = diffSearchers;
          
          // Create multiDiff interface
          query.multiDiff = {
            fetch: function() {
              var fetchPromises = [];
              
              angular.forEach(diffSearchers, function(searcher) {
                fetchPromises.push(searcher.search());
              });

              return $q.all(fetchPromises)
                .then(function() {
                  // Calculate diff scores for each searcher
                  var scorePromises = [];
                  angular.forEach(diffSearchers, function(searcher) {
                    var docsForScoring = searcher.docs.filter(function(d) { 
                      return d.ratedOnly === false; 
                    });
                    var scoreResult = query.scoreOthers(docsForScoring);
                    
                    // Handle both promise and non-promise returns
                    var resolvedPromise;
                    if (scoreResult && typeof scoreResult.then === 'function') {
                      resolvedPromise = scoreResult.then(function(scoreData) {
                        searcher.diffScore = scoreData;
                        return scoreData;
                      });
                    } else {
                      var deferred = $q.defer();
                      searcher.diffScore = scoreResult;
                      deferred.resolve(scoreResult);
                      resolvedPromise = deferred.promise;
                    }
                    
                    scorePromises.push(resolvedPromise);
                  });
                  
                  return $q.all(scorePromises);
                });
            },
            
            getSearchers: function() {
              return diffSearchers;
            },
            
            getSearcher: function(index) {
              return diffSearchers[index] || null;
            },
            
            docs: function(searcherIndex, onlyRated) {
              onlyRated = onlyRated || false;
              if (searcherIndex < 0 || searcherIndex >= diffSearchers.length) {
                return [];
              }
              return diffSearchers[searcherIndex].docs.filter(function(d) { 
                return d.ratedOnly === onlyRated; 
              });
            },
            
            allDocs: function(onlyRated) {
              var allDocs = [];
              onlyRated = onlyRated || false;
              
              angular.forEach(diffSearchers, function(searcher, index) {
                var docs = searcher.docs.filter(function(d) { 
                  return d.ratedOnly === onlyRated; 
                });
                allDocs.push({
                  searcherIndex: index,
                  docs: docs,
                  name: searcher.name()
                });
              });
              
              return allDocs;
            },
            
            name: function(searcherIndex) {
              if (angular.isDefined(searcherIndex) && diffSearchers[searcherIndex]) {
                return diffSearchers[searcherIndex].name();
              }
              return diffSearchers.map(function(searcher) {
                return searcher.name();
              }).join(' vs ');
            },
            
            names: function() {
              return diffSearchers.map(function(searcher) {
                return searcher.name();
              });
            },
            
            version: function(searcherIndex) {
              if (angular.isDefined(searcherIndex) && diffSearchers[searcherIndex]) {
                return diffSearchers[searcherIndex].version();
              }
              return diffSearchers.map(function(searcher) {
                return searcher.version();
              });
            },
            
            score: function(searcherIndex) {
              var deferred = $q.defer();
              
              if (angular.isDefined(searcherIndex) && diffSearchers[searcherIndex]) {
                deferred.resolve(diffSearchers[searcherIndex].diffScore || { score: null, allRated: false });
              } else {
                var allScores = diffSearchers.map(function(searcher) {
                  return searcher.diffScore || { score: null, allRated: false };
                });
                deferred.resolve(allScores);
              }
              
              return deferred.promise;
            },
            
            type: function() {
              return 'multi-snapshot';
            },
            
            count: function() {
              return diffSearchers.length;
            }
          };
          
          // Initialize all diffs
          query.multiDiff.fetch();
        } else {
          console.debug('no valid snapshots found for multi-diff!');
          query.multiDiff = null;
          query.multiDiffSearchers = [];
        }
      }

      this.createQueryDiff = function(query) {
        // Get current diff settings from queryViewSvc (the single source of truth)
        var allDiffSettings = queryViewSvc.getAllDiffSettings();
        
        if (allDiffSettings.length === 0) {
          query.diff = null;
          query.diffSearcher = null;
          query.multiDiff = null;
          query.multiDiffSearchers = [];
        } else {
          // Create multiDiff using internal method
          createQueryMultiDiff(query, allDiffSettings);
          
          // For single diff, create compatibility wrapper to maintain old diff interface
          if (allDiffSettings.length === 1 && query.multiDiff) {
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
          } else if (allDiffSettings.length > 1) {
            // Multi-diff mode - no need for compatibility wrapper
            query.diff = null;
          }
        }
      };
    }
  ]);
