'use strict';

/*jshint camelcase: false */
/*jslint latedef:false*/

// TODO: This should just be scorerSvc

(function() {
  angular.module('QuepidApp')
    .service('scorerSvc', [
      '$http', '$q', '$log',
      'broadcastSvc',
      'ScorerFactory',
      function($http, $q, $log, broadcastSvc, ScorerFactory) {
        var self = this;

        // make sure we have all scorers used for a case
        self.bootstrap         = bootstrap;
        self.constructFromData = constructFromData;
        self.create            = create;
        self.clearScorer       = clearScorer;
        self.defaultScorer     = new ScorerFactory();
        self.communalScorers    = [];
        self.delete            = deleteScorer;
        self.edit              = edit;
        self.get               = get;
        self.list              = list;
        self.resetScorer       = resetScorer;
        self.scalesAreEqual    = scalesAreEqual;
        self.scorers           = [];
        self.setDefault        = setDefault;
        self.scaleToArray      = scaleToArray;

        var contains = function(list, scorer) {
          return list.filter(function(item) { return item.scorerId === scorer.scorerId; }).length > 0;
        };

        function scaleToArray(string) {
          return string.replace(/^\s+|\s+$/g,'')
            .split(/\s*,\s*/)
            .map(function(item) {
              return parseInt(item, 10);
            });
        }

        function constructFromData(data) {
          return new ScorerFactory(data);
        }

        function scalesAreEqual(first, second) {
          if (angular.isString(first)) {
            first = self.defaultScorer.scaleToArray(first);
          }
          if (angular.isString(second)) {
            second = self.defaultScorer.scaleToArray(second);
          }

          // Make sure the two arrays are of the same type
          // (Integers instead of Strings)
          first = first.map(function(item) {
            return parseInt(item, 10);
          });
          second = second.map(function(item) {
            return parseInt(item, 10);
          });

          return angular.equals(first, second);
        }

        function create(scorer) {
          // http POST /api/scorers
          var url   = 'api/scorers';
          var scale = scorer.scale;
          if (angular.isString(scale)) {
            scale = scaleToArray(scale);
          }
          var data  = {
            'name':                   scorer.name,
            'code':                   scorer.code,
            'scale':                  scale,
            'show_scale_labels':      scorer.showScaleLabels,
            'scale_with_labels':      scorer.scaleWithLabels,
          };


          return $http.post(url, { 'scorer': data })
            .then(function(response) {
              var scorer = self.constructFromData(response.data);

              self.scorers.push(scorer);
              broadcastSvc.send('updatedScorersList');

              return scorer;
            });
        }

        // If you are editing a scorer used by your current Case, then you need to
        // hard reload the Case to get the newly edited scorer ;-(.
        function edit(scorer) {
          // http PUT /api/scorers/<int:scorerId>
          var url   = 'api/scorers/' + scorer.scorerId;

          var scale = scorer.scale;
          if (angular.isString(scale)) {
            scale = scaleToArray(scale);
          }

          var data  = {
            'scorer': {
              'name':                   scorer.name,
              'code':                   scorer.code,
              'scale':                  scale,
              'show_scale_labels':      scorer.showScaleLabels,
              'scale_with_labels':      scorer.scaleWithLabels,
            }
          };

          self.scorers.splice(self.scorers.indexOf(scorer), 1);

          return $http.put(url, data)
            .then(function(response) {
              var scorer = self.constructFromData(response.data);

              if(!contains(self.scorers, scorer)) {
                self.scorers.push(scorer);
                broadcastSvc.send('updatedScorersList');
              }

              return scorer;
            });
        }

        function deleteScorer(scorer) {
          // http DELETE /api/scorers/<int:scorerId>
          var url   = 'api/scorers/' + scorer.scorerId;

          return $http.delete(url)
          .then(function() {
            self.scorers.splice(self.scorers.indexOf(scorer), 1);
            broadcastSvc.send('updatedScorersList');
          });
        }

        function get(id, useCache) {
          if (!id) {
            return self.defaultScorer;
          }

          useCache   = typeof useCache !== 'undefined' ?  useCache : true;
          // http GET /api/scorers/<int:scorerId>
          var url    = 'api/scorers/' + id;
          var scorer = self.scorers.filter(function(item) { return item.scorerId === id; })[0];

          if (useCache && scorer) {
            return $q(function(resolve) {
              resolve(scorer);
            });
          } else {
            return $http.get(url)
            .then(function(response) {
              var scorer = self.constructFromData(response.data);

              if( !contains(self.scorers, scorer)) {
                self.scorers.push(scorer);
                broadcastSvc.send('updatedScorersList');
              }

              return scorer;
            });
          }
        }

        function list() {
          var url   = 'api/scorers';

          return $http.get(url)
          .then(function(response) {
            var data = response.data;

            angular.forEach(data.user_scorers, function(scorerData) {
              var scorer = self.constructFromData(scorerData);

              if(!contains(self.scorers, scorer)) {
                self.scorers.push(scorer);
              }
            });

            angular.forEach(data.communal_scorers, function(scorerData) {
              var scorer = self.constructFromData(scorerData);

              if(!contains(self.communalScorers, scorer)) {
                self.communalScorers.push(scorer);
              }
            });

            broadcastSvc.send('updatedScorersList');
          });
        }

        // bootstrap
        function bootstrap(caseNo) {
          var url = 'api/cases/' + caseNo + '/scorers';

          return $http.get(url)
          .then(function(response) {
            var data = response.data;

            angular.forEach(data.user_scorers, function(scorerData) {
              var scorer = self.constructFromData(scorerData);

              if(!contains(self.scorers, scorer)) {
                self.scorers.push(scorer);
              }
            });

            angular.forEach(data.communal_scorers, function(scorerData) {
              var scorer = self.constructFromData(scorerData);

              if(!contains(self.communalScorers, scorer)) {
                self.communalScorers.push(scorer);
              }
            });

            if(data.default) {
              setDefault(response.data.default);
            } else {
              resetScorer();
            }

            broadcastSvc.send('updatedScorersList');
          });
        }

        function setDefault(scorer) {
          var deferred = $q.defer();
          scorer = self.constructFromData(scorer);

          self.defaultScorer = scorer;
          deferred.resolve();

          return deferred.promise;
        }

        function resetScorer() {
          self.defaultScorer = new ScorerFactory();
        }

        function clearScorer() {
          self.defaultScorer = null;
        }
      }
    ]);
})();
