'use strict';

angular.module('QuepidApp')
  .service('caseSvc', [
    '$http', '$filter', '$q', '$rootScope',
    '$log',
    'caseTryNavSvc', 'queriesSvc', 'settingsSvc',
    'broadcastSvc',
    function caseSvc(
      $http, $filter, $q, $rootScope,
      $log,
      caseTryNavSvc, queriesSvc, settingsSvc,
      broadcastSvc
    ) {

      var bootstrapped = false;
      var cases = {};
      var selectedCase = null;
      var svc = this;

      svc.allCases          = [];
      this.archived         = [];
      this.dropdownCases    = [];
      svc.casesCount        = 0;

      // Functions
      svc.cloneCase         = cloneCase;
      svc.constructFromData = constructFromData;
      svc.filterCases       = filterCases;
      svc.get               = get;
      svc.getCases          = getCases;
      svc.isBootstrapped    = isBootstrapped;
      svc.listContainsCase  = listContainsCase;
      svc.refetchCaseLists  = refetchCaseLists;
      svc.runEvaluation     = runEvaluation;
      svc.saveDefaultScorer = saveDefaultScorer;
      svc.renameCase        = renameCase;
      svc.updateNightly     = updateNightly;
      svc.associateBook     = associateBook;

      // an individual case, ie
      // a search problem to be solved
      var Case = function(data) {
        var theCase               = this;

        theCase.caseNo            = data.case_id;
        theCase.lastTry           = data.last_try_number;
        theCase.caseName          = data.case_name;
        theCase.lastScore         = data.last_score;
        theCase.scorerId          = data.scorer_id;
        theCase.owned             = data.owned;
        theCase.ownerName         = data.owner_name;
        theCase.ownerId           = data.owner_id;
        theCase.bookId            = data.book_id;
        theCase.bookName          = data.book_name;
        theCase.queriesCount      = data.queries_count;
        theCase.public            = data.public;
        theCase.archived          = data.archived;
        theCase.nightly           = data.nightly;
        theCase.teams             = data.teams || [];
        theCase.tries             = data.tries || [];
        theCase.scores            = data.scores || [];
        theCase.queries           = data.queries || [];

        theCase.teamNames = function() {
          var names = [];

          angular.forEach(theCase.teams, function(team) {
            names.push(team.name);
          });

          return names.join(', ');
        };

        theCase.fetchCaseScore = function() {
          // http GET api/cases/<int:caseId>/scores
          var url = 'api/cases/' + theCase.caseNo + '/scores';

          return $http.get(url)
            .then(function(response) {
              theCase.lastScore = response.data;

              return theCase;
            });
        };

        theCase.fetchCaseScores = function() {
          // http GET api/cases/<int:caseId>/scores/all
          var url = 'api/cases/' + theCase.caseNo + '/scores/all';

          return $http.get(url)
            .then(function(response) {
              theCase.scores = response.data.scores;

              return theCase;
            });
        };

        $rootScope.$on('settings-updated', function(event, args) {
          if ( args.caseNo === theCase.caseNo ) {
            theCase.lastTry = args.lastTry.tryNo;
          }
        });
      };

      $rootScope.$on('caseRenamed', function(event, args) {
        if ( svc.isCaseSelected() && args.caseNo === svc.getSelectedCase().caseNo ) {
          svc.getSelectedCase().caseName = args.caseName;
        }
      });

      $rootScope.$on('caseTeamAdded', function(event, args) {
        if ( svc.isCaseSelected() && args.caseNo === svc.getSelectedCase().caseNo ) {
          svc.getSelectedCase().teams.push(args.team);
        }
      });

      // resolve promise when bootstrapped
      this.uponBeingBootstrapped = function() {
        var self = this;

        if (bootstrapped) {
          return $q(function(resolve) {
            resolve();
          });
        }
        return self.refetchCaseLists()
          .then(function() {
            bootstrapped = true;
            broadcastSvc.send('bootstrapped', self.allCases);
          });
      };

      this.selectCase = function(caseNo) {
        var cases = this.allCases.slice(); // shallow copy (dont create new cases)
        angular.forEach(cases, function(aCase) {
          if (aCase.caseNo === caseNo) {
            selectedCase = aCase;
          }
        });
      };

      this.selectTheCase = function(theCase) {
        selectedCase = theCase;
        broadcastSvc.send('caseSelected', selectedCase);
      };

      this.isCaseSelected = function() {
        return selectedCase !== null;
      };

      this.getSelectedCase = function() {
        return selectedCase;
      };

      this.createCase = function(caseName, queries, tries) {
        // http POST api/cases
        // returns as if we did HTTP GET /cases/<caseNo>
        // on success, sets current case number to case number
        var data = {'case_name': 'Case: ' + this.casesCount};
        if (caseName) {
          data.case_name = caseName;
        }
        if (queries) {
          data.queries = queries;
        }
        if (tries) {
          data.tries = tries;
        }
        var that = this;
        $http.post('api/cases', data)
          .then(function(response) {
            var newCase   = new Case(response.data);
            var caseTries = response.data.tries;

            that.allCases.push(newCase);
            broadcastSvc.send('updatedCasesList', svc.allCases);

            var caseTryObj = {};
            caseTryObj.caseNo   = newCase.caseNo;
            caseTryObj.navTryNo = newCase.lastTry;

            // TODO: see if this is still necessary!
            settingsSvc.setSettings(caseTries, newCase.lastTry);
            caseTryNavSvc.navigateTo(caseTryObj);
          }, function(){
            caseTryNavSvc.notFound();
          });
      };


      this.deleteCase = function(caseToDelete) {
        var that        = this;
        var caseNumber  = caseToDelete.caseNo;

        return $http.delete('api/cases/' + caseNumber)
          .then(function() {
            that.refetchCaseLists();

            if( selectedCase !== null && selectedCase.caseNo === caseNumber ) {
              selectedCase = null;
            }
          });
      };

      this.deleteCaseQueries = function(caseToDeleteQueries) {
        var that        = this;
        var caseNumber  = caseToDeleteQueries.caseNo;

        return $http.delete('api/bulk/cases/' + caseNumber + '/queries/delete')
          .then(function() {
            that.refetchCaseLists();
            if( selectedCase !== null && selectedCase.caseNo === caseNumber ) {
              selectedCase = null;
            }
            queriesSvc.reset();
          });
      };

      this.archiveCase = function(caseToArchive) {
        var caseNumber  = caseToArchive.caseNo;
        var url         = 'api/cases/' + caseNumber;
        var data        = { archived: true };

        return $http.put(url, data)
          .then(function(response) {
            var data    = response.data;
            var newCase = new Case(data);

            // the .filter() should work, but doesn't so instead combine with a splice.
            var indexOfCase = svc.allCases.indexOf( svc.allCases.filter( function (item) {
              return item.caseNo === newCase.caseNo;
            })[0] );
            svc.allCases.splice(indexOfCase, 1);
            //svc.allCases = svc.allCases.filter( function(acase) {
            //  acase.caseNo !== newCase.caseNo;
            //});
            svc.archived.push(newCase);

            broadcastSvc.send('updatedCasesList', svc.allCases);
          });
      };

      this.unarchiveCase = function(caseToUnarchive) {
        var caseNumber  = caseToUnarchive.caseNo;
        var url         = 'api/cases/' + caseNumber;
        var data        = { archived: false };

        return $http.put(url, data)
          .then(function(response) {
            var data    = response.data;
            var newCase = new Case(data);

            svc.allCases.push(newCase);
            svc.archived = svc.archived.filter( function(acase) {
              acase.caseNo !== newCase.caseNo;
            });

            broadcastSvc.send('updatedCasesList', svc.allCases);
          });
      };

      this.fetchArchived = function() {
        svc.archived = [];

        return $http.get('api/cases?archived=true')
          .then(function(response) {
            angular.forEach(response.data.all_cases, function(rawCase) {
              var newCase = constructFromData(rawCase);

              if ( !listContainsCase(svc.archived, newCase) ) {
                svc.archived.push(newCase);
              }
            });
          });
      };

      this.fetchDropdownCases = function() {
        var self = this;
        self.dropdownCases.length = 0;
        return $http.get('api/dropdown/cases')
          .then(function(response) {
            self.casesCount = response.data.cases_count;

            angular.forEach(response.data.all_cases, function(rawCase) {
              var newCase = new Case(rawCase);

              if ( !listContainsCase(svc.dropdownCases, newCase) ) {
                self.dropdownCases.push(newCase);
              }
            });

            broadcastSvc.send('fetchedDropdownCasesList', svc.allCases);
          });
      };
      
      this.importCase = function(caseToImport) {
        var that = this;
        var url         = 'api/import/cases';
        var data        = { case: caseToImport };

        return $http.post(url, data)
          .then(function(response) {          
              that.refetchCaseLists();
            return response.data;
          });
      };

      this.trackLastViewedAt = function(caseNo) {
        var url         = 'api/cases/'+ caseNo + '/metadata';
        var dateFormat  = 'yyyy-MM-dd HH:mm:ss';
        var data        = {
          'metadata': {
            'last_viewed_at': $filter('date')(new Date(), dateFormat)
          }
        };

        return $http.put(url, data);
      };

      this.trackLastScore = function(caseNo, scoreData) {
        var self = this;

        if (  angular.isUndefined(scoreData.queries) ||
              scoreData.queries === null ||
              Object.keys(scoreData.queries).length === 0
        ) {
          return $q(function(resolve) {
            resolve();
          });
        }

        var url         = 'api/cases/'+ caseNo + '/scores';

        // Replace null values by an empty string for query scores,
        // in order to normalize values when score is not present:
        angular.forEach(scoreData.queries, function(score, id) {
          if (score === null || score === undefined || score === 'Null') {
            scoreData.queries[id] = '';
          }
        });

        var data = { 'case_score': scoreData };

        return $http.put(url, data)
          .then(function(response) {
            var caseExists = false;
            var theCase;

            angular.forEach(self.allCases, function(c) {
              if (c.caseNo === caseNo) {
                c.lastScore = response.data;
                caseExists  = true;
                theCase     = c;
              }
            });

            if ( !caseExists || angular.isUndefined(theCase) ) {
              theCase = {
                caseNo:     caseNo,
                lastScore:  response.data,
              };
            }

            broadcastSvc.send('updatedCaseScore', theCase);
            return response;
          });
      };

      /*jslint latedef:false*/
      function getCases () {       
        // http GET api/cases
        var url = 'api/cases';

        svc.allCases.length = 0;
        return $http.get(url)
          .then(function(response) {
            var data = response.data;

            angular.forEach(data.all_cases, function(rawCase) {
              var newCase = constructFromData(rawCase);

              if ( !listContainsCase(svc.allCases, newCase) ) {
                svc.allCases.push(newCase);
              }
            });

            bootstrapped = true;
          }, function() {
            caseTryNavSvc.notFound();
          });
      }

      function filterCases (cases, owned) {
        if ( angular.isUndefined(owned) ) {
          owned = false;
        }

        return cases.filter(function(item) {
          return item.owned === owned;
        });
      }

      function constructFromData(data) {
        return new Case(data);
      }

      /*
       * take a scorerId or null and send that information
       * to the server to save on a case
       */
      function saveDefaultScorer(caseId, scorerId) {
        // http PUT api/cases/<int:caseId>/scorers/<int:scorerId>
        scorerId  =  scorerId || 0;
        var url   = 'api/cases/' + caseId + '/scorers/' + scorerId;
        var data  = {};

        return $http.put(url, data)
          .then( function(response) {
            return response;
          });
      }

      /*
       * rename the case.  This could be refactored into a more
       * general "update" method.
       */
      function renameCase(theCase, newName) {
        if (newName.length > 0) {
          // http PUT api/cases/<int:caseId>
          var url  = 'api/cases/' + theCase.caseNo;
          var data = {
            case_name: newName
          };

          return $http.put(url, data)
            .then(function() {
              theCase.caseName = newName;
              broadcastSvc.send('caseRenamed', theCase);
            }, function() {
              caseTryNavSvc.notFound();
            });
        }
      }
      
      /*
       * update the recurrent status of the case.  This could be refactored into a more
       * general "update" method.
       */
      function updateNightly(theCase) {

        // http PUT api/cases/<int:caseId>
        var url  = 'api/cases/' + theCase.caseNo;
        var data = {
          nightly: theCase.nightly
        };

        return $http.put(url, data)
          .then(function() {
            broadcastSvc.send('caseUpdate', theCase);
          }, function() {
            caseTryNavSvc.notFound();
          });

      }

      /*
       * Queues a background job to run all queries in the case and score the results.
       */
      function runEvaluation(caseNo, tryNumber) {
        // http POST api/cases/<int:caseId>/run_evaluation
        var url  = 'api/cases/' + caseNo + '/run_evaluation';
        var params = {};
        if (tryNumber) {
          params.try_number = tryNumber;
        }

        return $http.post(url, null, { params: params });
      }      

      /*
       * update which book the case is tied to.  This could be refactored into a more
       * general "update" method.
       */
      function associateBook(theCase, bookId) {

        // HTTP PUT api/cases/<int:caseId>
        var url  = 'api/cases/' + theCase.caseNo;
        var data = {
          book_id: bookId
        };

        return $http.put(url, data)
          .then(function(response) {

            theCase.bookId = bookId;
            theCase.bookName = response.book_name;
            broadcastSvc.send('associateBook', svc.dropdownBooks);
          }, function() {
            caseTryNavSvc.notFound();
          });
      }


      function get(id, useCache) {
        // http GET api/cases/<int:caseId>
        var url  = 'api/cases/' + id;
        useCache = typeof useCache !== 'undefined' ?  useCache : true;

        var ccase = cases[id];
        if (useCache && ccase) {
          return $q(function(resolve) {
            resolve(ccase);
          });
        }
        else {
          return $http.get(url)
            .then(function(response) {
              var acase = constructFromData(response.data);
              cases[acase.id] = acase;

              var index = svc.allCases.indexOf( svc.allCases.filter( function (item) {
                return item.caseNo === acase.caseNo;
              })[0] );

              svc.allCases[index] = acase;
              return acase;
            }, function() {
              $log.info('Did not find the case ' + id);              
          });
        }
      }

      function cloneCase(theCase, options) {
        var url             = 'api/clone/cases';

        if ( angular.isUndefined(options) ) {
          options = {};
        }

        var opts            = {
          clone_queries:    options.queries,
          clone_ratings:    options.ratings,
          preserve_history: options.history,
          try_number:       options.tryId,
          case_name:        options.caseName
        };
        var defaultOptions  = {
          case_id:          theCase.caseNo,
          clone_queries:    false,
          clone_ratings:    false,
          preserve_history: false,
          try_number:       null,
        };

        var data = angular.extend({}, defaultOptions, opts);

        return $http.post(url, data)
          .then(function(response) {
            var acase       = constructFromData(response.data);
            cases[acase.id] = acase;

            svc.allCases.push(acase);
            broadcastSvc.send('updatedCasesList', svc.allCases);

            return acase;
          });
      }

      function refetchCaseLists () {
        return svc.getCases()
          .then(function () {
            return svc.fetchDropdownCases()
              .then(function() {
                broadcastSvc.send('updatedCasesList', svc.allCases);
              });
          });
      }

      function listContainsCase (list, c) {
        var check = list.filter(function(e) { return c.caseNo === e.caseNo; });

        return check.length > 0;
      }

      function isBootstrapped () {
        return bootstrapped;
      }
    }
  ]);
