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
    function diffResultsSvc(
      $q,
      $log,
      querySnapshotSvc,
      settingsSvc
    ) {

      var diffSetting = null;

      // no results
      var NullFetcher = function() {
        this.version = function() {
          return 0;
        };

        this.docs = [];

        this.fetch = function() {
          return $q(function(resolve) {
            resolve();
          });
        };

        this.name = function() {
          return '';
        };
      };

      // Adapter for the diff results...
      // fetch results associated with a snapshot for a specific query
      var QuerySnapshotFetcher = function(snapshot, query) {
        this.docs = [];
        this.version = function() {
          return query.version();
        };

        var thisFetcher = this;
        this.fetch = function() {
          thisFetcher.docs.length = 0;
          var savedSearchResults = snapshot.getSearchResults(query.queryId);

          angular.forEach(savedSearchResults, function loopBody(doc) {
            if ( angular.isDefined(doc) && doc !== null) {
              var rateableDoc = query.ratingsStore.createRateableDoc(doc);
              rateableDoc.ratedOnly = doc.rated_only ? doc.rated_only : false;
              thisFetcher.docs.push(rateableDoc);
            }
          });

          return $q(function(resolve) {
            resolve();
          });
        };

        this.name = function() {
          return snapshot.name();
        };
      };

      var nullFetcher = new NullFetcher();


      var QueryDiffResults = function(query, fetcher, type) {
        var thisQDiff = this;

        thisQDiff.fetcher   = fetcher;
        thisQDiff.diffScore = { score: null, allRated: false };

        var fetch = function() {
          var settings = settingsSvc.editableSettings();

          return thisQDiff.fetcher.fetch(settings)
            .then(function() {
              thisQDiff.diffScore = query.scoreOthers(thisQDiff.fetcher.docs.filter(d => d.ratedOnly === false));
            }, function(response) {
              $log.debug('Failed to fetch diff: ', response);
              return response;
            });
        };

        this.fetch = fetch;

        this.version = function() {
          return this.fetcher.version();
        };

        this.score = function() {
          var deferred = $q.defer();
          deferred.resolve(this.diffScore);
          return deferred.promise;
        };

        this.docs = function(onlyRated) {
          onlyRated = onlyRated || false;

          return this.fetcher.docs.filter(d => d.ratedOnly === onlyRated);
        };

        this.name = function() {
          return this.fetcher.name();
        };

        this.type = function() {
          return type;
        };

        this.fetch();
      };

      this.setDiffSetting = function(currDiffSetting) {
        diffSetting = currDiffSetting;
      };

      this.createQueryDiff = function(query) {
        var fetcher = nullFetcher;

        if (diffSetting === null) {
          query.diff = null;          
        } else {
          var snapshot = querySnapshotSvc.snapshots[diffSetting];

          if ( snapshot ) {
            fetcher = new QuerySnapshotFetcher(snapshot, query);
            query.diff = new QueryDiffResults(query, fetcher, 'snapshot');
          } else {
            console.debug('snapshot not found!');
          }
        }
      };
    }
  ]);
