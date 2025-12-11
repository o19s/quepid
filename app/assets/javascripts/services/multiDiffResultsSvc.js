'use strict';
/*
 * Extended service for managing multiple snapshot diffs
 * Allows comparing current search results against 2-3 snapshots simultaneously
 * */
angular.module('QuepidApp')
  .service('multiDiffResultsSvc', [
    '$q',
    '$log',
    'querySnapshotSvc',
    'settingsSvc',
    'snapshotSearcherSvc',
    function multiDiffResultsSvc(
      $q,
      $log,
      querySnapshotSvc,
      settingsSvc,
      snapshotSearcherSvc
    ) {

      var multiDiffSettings = [];
      var maxSnapshots = 3;

      this.setMultiDiffSettings = function(diffSettings) {
        multiDiffSettings = diffSettings || [];
        // Limit to maximum number of snapshots
        if (multiDiffSettings.length > maxSnapshots) {
          multiDiffSettings = multiDiffSettings.slice(0, maxSnapshots);
        }
      };

      this.getMultiDiffSettings = function() {
        return multiDiffSettings;
      };

      this.isMultiDiffEnabled = function() {
        return multiDiffSettings.length > 1;
      };

      this.createQueryMultiDiff = function(query) {
        if (multiDiffSettings.length === 0) {
          query.multiDiff = null;
          query.multiDiffSearchers = [];
          return;
        }

        var settings = settingsSvc.editableSettings();
        var diffSearchers = [];
        var validSearchers = [];

        // Create searchers for each snapshot
        angular.forEach(multiDiffSettings, function(diffSetting) {
          var diffSearcher = snapshotSearcherSvc.createSearcherFromSnapshot(diffSetting, query, settings);
          if (diffSearcher) {
            diffSearchers.push(diffSearcher);
            validSearchers.push({
              searcher: diffSearcher,
              setting: diffSetting
            });
          }
        });

        if (validSearchers.length > 0) {
          query.multiDiffSearchers = diffSearchers;
          
          // Create compatibility wrapper for multiple diffs
          query.multiDiff = {
            fetch: function() {
              var fetchPromises = [];
              
              angular.forEach(diffSearchers, function(searcher) {
                fetchPromises.push(searcher.search());
              });

              return $q.all(fetchPromises)
                .then(function() {
                  // Calculate diff scores for each searcher
                  angular.forEach(diffSearchers, function(searcher, index) {
                    var docsForScoring = searcher.docs.filter(function(d) { 
                      return d.ratedOnly === false; 
                    });
                    searcher.diffScore = query.scoreOthers(docsForScoring);
                  });
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
                // Return scores for all searchers
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
      };
      
      this.getMaxSnapshots = function() {
        return maxSnapshots;
      };
    }
  ]);